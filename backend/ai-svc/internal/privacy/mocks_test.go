package privacy

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/link-app/ai-svc/internal/model"
)

// MockDB provides a mock database implementation for testing
type MockDB struct {
	mu            sync.RWMutex
	userConsents  map[uuid.UUID]*model.UserConsent
	auditLogs     []model.AuditLog
	policyVersion *model.PrivacyPolicyVersion
	anonymizationRecords map[string]*model.DataAnonymizationRecord
	shouldFailGet bool
	shouldFailExec bool
}

// NewMockDB creates a new mock database
func NewMockDB() *MockDB {
	return &MockDB{
		userConsents:         make(map[uuid.UUID]*model.UserConsent),
		auditLogs:           []model.AuditLog{},
		anonymizationRecords: make(map[string]*model.DataAnonymizationRecord),
		policyVersion: &model.PrivacyPolicyVersion{
			ID:            uuid.New(),
			Version:       "1.0",
			Content:       "Test privacy policy content",
			EffectiveDate: time.Now(),
			IsActive:      true,
			CreatedAt:     time.Now(),
		},
	}
}

// SetShouldFail configures the mock to simulate database errors
func (m *MockDB) SetShouldFail(get, exec bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shouldFailGet = get
	m.shouldFailExec = exec
}

// GetContext simulates sqlx.DB.GetContext for querying single records
func (m *MockDB) GetContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldFailGet {
		return fmt.Errorf("mock database get error")
	}

	// Handle user consent queries
	if containsQuery(query, "user_consent") && len(args) > 0 {
		if userID, ok := args[0].(uuid.UUID); ok {
			if consent, exists := m.userConsents[userID]; exists {
				// Copy the consent to dest
				if consentPtr, ok := dest.(*model.UserConsent); ok {
					*consentPtr = *consent
					return nil
				}
			}
			return fmt.Errorf("no rows in result set") // Simulate sql.ErrNoRows
		}
	}

	// Handle privacy policy queries
	if containsQuery(query, "privacy_policy_versions") {
		if policyPtr, ok := dest.(*model.PrivacyPolicyVersion); ok {
			*policyPtr = *m.policyVersion
			return nil
		}
	}

	// Handle anonymization record queries
	if containsQuery(query, "data_anonymization_records") && len(args) >= 2 {
		if _, ok := args[0].(uuid.UUID); ok {
			if hash, ok := args[1].(string); ok {
				if record, exists := m.anonymizationRecords[hash]; exists {
					if recordPtr, ok := dest.(*model.DataAnonymizationRecord); ok {
						*recordPtr = *record
						return nil
					}
				}
				return fmt.Errorf("no rows in result set")
			}
		}
	}

	return fmt.Errorf("no matching mock data found")
}

// SelectContext simulates sqlx.DB.SelectContext for querying multiple records
func (m *MockDB) SelectContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldFailGet {
		return fmt.Errorf("mock database select error")
	}

	// Handle audit logs queries
	if containsQuery(query, "audit_logs") {
		if logsPtr, ok := dest.(*[]model.AuditLog); ok {
			// Filter logs based on user_id or action if provided
			filteredLogs := make([]model.AuditLog, 0)
			
			if len(args) > 0 {
				if userID, ok := args[0].(uuid.UUID); ok {
					// Filter by user ID
					for _, log := range m.auditLogs {
						if log.UserID != nil && *log.UserID == userID {
							filteredLogs = append(filteredLogs, log)
						}
					}
				} else if action, ok := args[0].(string); ok {
					// Filter by action
					for _, log := range m.auditLogs {
						if log.Action == action {
							filteredLogs = append(filteredLogs, log)
						}
					}
				}
			} else {
				filteredLogs = m.auditLogs
			}

			*logsPtr = filteredLogs
			return nil
		}
	}

	return fmt.Errorf("no matching mock data found")
}

// ExecContext simulates sqlx.DB.ExecContext for INSERT/UPDATE/DELETE operations
func (m *MockDB) ExecContext(ctx context.Context, query string, args ...interface{}) (MockResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldFailExec {
		return MockResult{}, fmt.Errorf("mock database exec error")
	}

	// Handle audit log inserts
	if containsQuery(query, "INSERT INTO audit_logs") {
		// Create a new audit log
		log := model.AuditLog{
			ID:           uuid.New(),
			CreatedAt:    time.Now(),
		}

		// Extract fields from args (simplified - in real tests you'd parse more carefully)
		if len(args) >= 2 {
			if userID, ok := args[0].(*uuid.UUID); ok {
				log.UserID = userID
			}
			if action, ok := args[1].(string); ok {
				log.Action = action
			}
		}

		m.auditLogs = append(m.auditLogs, log)
		return MockResult{rowsAffected: 1}, nil
	}

	// Handle anonymization record inserts
	if containsQuery(query, "INSERT INTO data_anonymization_records") {
		if len(args) >= 3 {
			if recordID, ok := args[0].(uuid.UUID); ok {
				if userID, ok := args[1].(uuid.UUID); ok {
					if originalHash, ok := args[2].(string); ok {
						record := &model.DataAnonymizationRecord{
							ID:               recordID,
							UserID:           userID,
							OriginalDataHash: originalHash,
							AnonymizedAt:     time.Now(),
						}
						m.anonymizationRecords[originalHash] = record
						return MockResult{rowsAffected: 1}, nil
					}
				}
			}
		}
	}

	// Handle delete operations
	if containsQuery(query, "DELETE FROM audit_logs") {
		deletedCount := int64(len(m.auditLogs))
		m.auditLogs = []model.AuditLog{} // Clear all logs
		return MockResult{rowsAffected: deletedCount}, nil
	}

	return MockResult{rowsAffected: 1}, nil
}

// BeginTxx simulates starting a transaction
func (m *MockDB) BeginTxx(ctx context.Context, opts interface{}) (*MockTx, error) {
	if m.shouldFailExec {
		return nil, fmt.Errorf("mock transaction begin error")
	}
	return &MockTx{db: m}, nil
}

// MockTx represents a mock database transaction
type MockTx struct {
	db        *MockDB
	committed bool
	rollback  bool
}

// GetContext delegates to the underlying mock DB
func (tx *MockTx) GetContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return tx.db.GetContext(ctx, dest, query, args)
}

// ExecContext delegates to the underlying mock DB
func (tx *MockTx) ExecContext(ctx context.Context, query string, args ...interface{}) (MockResult, error) {
	return tx.db.ExecContext(ctx, query, args)
}

// Commit simulates committing a transaction
func (tx *MockTx) Commit() error {
	if tx.db.shouldFailExec {
		return fmt.Errorf("mock transaction commit error")
	}
	tx.committed = true
	return nil
}

// Rollback simulates rolling back a transaction
func (tx *MockTx) Rollback() error {
	tx.rollback = true
	return nil
}

// MockResult simulates sql.Result
type MockResult struct {
	rowsAffected int64
	lastInsertId int64
}

func (r MockResult) RowsAffected() (int64, error) {
	return r.rowsAffected, nil
}

func (r MockResult) LastInsertId() (int64, error) {
	return r.lastInsertId, nil
}

// Helper function to check if query contains a substring
func containsQuery(query, substr string) bool {
	return strings.Contains(query, substr)
}

// AddUserConsent adds a user consent record to the mock database
func (m *MockDB) AddUserConsent(userID uuid.UUID, consent *model.UserConsent) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.userConsents[userID] = consent
}

// AddAuditLog adds an audit log to the mock database
func (m *MockDB) AddAuditLog(log model.AuditLog) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.auditLogs = append(m.auditLogs, log)
}

// GetAuditLogsCount returns the number of audit logs
func (m *MockDB) GetAuditLogsCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.auditLogs)
}

// SetPolicyVersion updates the mock policy version
func (m *MockDB) SetPolicyVersion(version *model.PrivacyPolicyVersion) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.policyVersion = version
}
