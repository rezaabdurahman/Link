# Hybrid Conversation Recommendation Pipeline (v1)

This document describes the architecture, data schema, and implementation plan for building a hybrid model that recommends which conversations a user should reply to, optimized for **deeper connections** rather than quick replies.

---

## 🏗️ Architecture Overview

1. **Ingest & normalize** messages → store into DB (`conversations`, `people`, `messages`).
2. **Feature extraction**
   - Structured features (recency, cadence, reciprocity, inner_circle, etc.).
   - LLM features (needs_reply, contains_action_or_date, sentiment_score, embeddings).
3. **Candidate generation** → filter to <= 100 candidates.
4. **Scoring**
   - XGBoost LTR model → shortlist top K (e.g., 20).
5. **Optional LLM reranker**
   - Rerank top 20 using LLM cross-encoder.
6. **Surface** top 5 with explanation strings.
7. **Log** user actions (reply/skip/snooze).
8. **Retrain** LTR periodically.

---

## 🗂️ Data Schema

### `conversations`
| field | type | notes |
|-------|------|-------|
| `conversation_id` | string | unique thread id |
| `person_id` | string | FK to `people` |
| `platform` | enum | e.g., `imessage`, `whatsapp` |
| `last_inbound_ts` | timestamp | last message received |
| `last_outbound_ts` | timestamp | last message sent |
| `unread_count` | int | optional salience |
| `last_msg_text` | text | raw or embeddings |
| `contains_question` | bool | LLM classifier |
| `contains_action_or_date` | bool | LLM/regex |
| `sentiment_score` | float | [-1,1] |
| `special_date_flag` | bool | birthday/anniversary |
| `cadence_gap_days` | float | current gap vs cadence |

### `people`
| field | type | notes |
|-------|------|-------|
| `person_id` | string | unique person id |
| `inner_circle` | bool | user-defined |
| `potential_to_evolve_score` | float | inbound rate × not inner circle |
| `timezone` | string | e.g., `US/Eastern` |
| `birthday` | date | optional |
| `anniversary` | date | optional |
| `avg_reply_latency` | float | median reply delay |
| `historical_depth` | float | median turns per conversation |

### `user_sessions`
| field | type | notes |
|-------|------|-------|
| `session_id` | string | app session |
| `user_id` | string | |
| `session_start_ts` | timestamp | |
| `recommendations` | array | list of (conversation_id, score, rank, explanation) |

### `labels`
| field | type | notes |
|-------|------|-------|
| `label_id` | string | |
| `session_id` | string | FK |
| `conversation_id` | string | FK |
| `surfaced_ts` | timestamp | recommendation time |
| `position` | int | rank shown |
| `user_action` | enum | {reply, skip, snooze} |
| `reply_latency_sec` | float | if replied |
| `reply_length_chars` | int | proxy for depth |
| `turns_next48h` | int | follow-up depth |

---

## ⚙️ Feature Extraction

### Structured features
- `hours_since_last_inbound`
- `hours_since_last_outbound`
- `unread_count`
- `days_since_last_contact`
- `reciprocity_gap`
- `cadence_gap_days`
- `inner_circle`
- `special_date_flag`
- `platform`
- `coverage_penalty_session`

### LLM-derived features
- `needs_reply_prob` (0–1)
- `contains_date_action_prob` (0–1)
- `sentiment_score` ([-1..1])
- `relationship_tone` (categorical)
- `short_text_embedding` (vector)

---

## 🔄 Candidate Generation

Heuristic filters:
- Include convos with `last_inbound_ts` within 30d OR `unread_count > 0` OR `special_date_flag == 1`.
- Cap to top 100 by recency.

---

## 🧮 Scoring

### XGBoost LTR
- Input: structured + LLM-derived features.
- Labels: replied within 24–48h (graded relevance possible).
- Grouped by session (for ranking).

**Training sketch (Python pseudocode):**
```python
import xgboost as xgb

X, y, qid = load_features_and_labels()  # qid = session_id
dtrain = xgb.DMatrix(X, label=y)
dtrain.set_group(qid)

params = {
    "objective": "rank:pairwise",
    "eta": 0.1,
    "max_depth": 6,
    "eval_metric": "ndcg"
}
bst = xgb.train(params, dtrain, num_boost_round=200)
bst.save_model("xgb_ltr.model")
```

### Optional LLM Reranker
- Input: top K=20 convos from XGBoost.
- Prompt LLM with text + metadata → return score 0–1 + explanation.
- Sort by score, surface top 5.

---

## 📝 Explanation Generation

- **Template-based** (fast): pick top features → string like  
  - "Asked a question 2d ago"  
  - "Birthday today 🎂"  
  - "You haven’t spoken in 9 days"  
- **LLM-based** (nicer UX): ask for 1-line explanation.

---

## 🧪 Evaluation

### Offline
- NDCG@5 vs recency baseline.
- Precision@K, AUC of reply prediction.

### Online
- **Primary:** reply_rate@5 = (# surfaced that got a reply) / 5.
- **Secondary:** avg reply length, multi-turn % in 48h, diversity % (non-inner-circle).

---

## 📊 Monitoring

- Track feature drift (e.g., avg `needs_reply_prob`).
- Log model confidence & SHAP for surfaced items.
- GDPR/CCPA: purge raw text as required, store hashed IDs only.

---

## 🚀 Rollout Plan

1. **Alpha**: Heuristic ranker only.
2. **Beta**: Add LLM feature extractors, retrain XGBoost.
3. **Experiment**: Rerank top 20 with LLM, test vs. baseline.
4. **Production**: Deploy best hybrid combo.

---

## 📋 Checklist

- [ ] DB tables (`messages`, `conversations`, `people`, `user_sessions`, `labels`).
- [ ] LLM feature extraction service (batched, cached).
- [ ] Candidate generation job.
- [ ] XGBoost inference service.
- [ ] Optional reranker service.
- [ ] Logging pipeline for labels/metrics.
- [ ] Monitoring dashboards.

---
