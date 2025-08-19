# Development Tooling Architecture

## CI/CD Pipeline

### AI Indexing Optimization Safeguard

The CI pipeline includes a `warp-indexing-check` job that prevents repository bloat from affecting AI performance. This safeguard:

#### What it checks:
- **File Count Monitoring**: Counts total repository files vs. files that would be indexed by Warp AI
- **Efficiency Threshold**: Fails CI if more than 5% of files would be indexed (indicating bloat)
- **Configuration Validation**: Ensures `.warpignore` file exists and is properly configured

#### Thresholds:
- ✅ **Optimal**: ≤5% of files indexed (~500-1000 files out of ~20,000-100,000 total)
- ❌ **Bloated**: >5% of files indexed (indicates missing .warpignore patterns or excessive artifacts)

#### How it works:
```bash
# Count total files
TOTAL_FILES=$(find . -type f | wc -l)

# Count files that would be indexed (simulates .warpignore)
INDEXED_FILES=$(find . -type f | \
  grep -v -E "(node_modules|Link-|coverage|\.git|dist|build|out|\.log$|\.tmp$|vendor)" | \
  grep -v -E "\.(md|png|jpg|jpeg|gif|svg|mp4|avi|mov|webm|ico)$" | \
  wc -l)

# Calculate percentage and fail if >5%
PERCENTAGE=$(( (INDEXED * 100) / TOTAL ))
```

#### Benefits:
- **Prevents token bloat**: Stops PRs that would degrade AI performance
- **Maintains efficiency**: Ensures AI continues to focus on relevant code
- **Early detection**: Catches repository bloat before it affects development workflow
- **Automated enforcement**: No manual monitoring required

#### Excluded patterns (automatically ignored):
- `node_modules/` - Dependencies (470M+)
- `Link-*/` - Temporary duplicate directories
- `coverage/`, `dist/`, `build/` - Build artifacts
- `*.md` - Markdown files (4,298+ files excluded, keeping only essential docs)
- Media files: `*.png`, `*.jpg`, `*.svg`, `*.mp4`, etc.
- Log files, temporary files, IDE configs

#### Included patterns (indexed by AI):
- Source code: `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.go`, `*.vue`
- Configuration: `package.json`, `tsconfig.json`, `Dockerfile*`, `docker-compose*`
- Essential docs: `README.md`, `CHANGELOG.md`, `docs/architecture/*.md`
- Infrastructure: `*.tf`, `*.yaml`, `*.yml`

### Integration with Development Workflow

Following the project's development rules:

1. **Feature Branch Development**: Safeguard runs on all PRs
2. **No Direct Main Commits**: Bloat prevention enforced before merge
3. **Conventional Commits**: CI job failure provides clear error messages
4. **Code Coverage Integration**: Complements existing 60% coverage requirements

### Troubleshooting

If the indexing check fails:

1. **Review the failure message**: Shows exact file counts and percentage
2. **Update `.warpignore`**: Add patterns for new file types causing bloat
3. **Clean artifacts**: Remove build outputs, logs, or temporary files
4. **Validate locally**: 
   ```bash
   find . -type f | wc -l  # Total files
   find . -type f | grep -v -f .warpignore | wc -l  # Would be indexed
   ```

### Historical Context

- **Before optimization**: 97,935+ files, 4,298+ markdown files indexed
- **After optimization**: ~546 essential files indexed (99.4% reduction)
- **Token savings**: 80-90% reduction in AI context size per query
- **Performance improvement**: Faster AI responses, better code focus
