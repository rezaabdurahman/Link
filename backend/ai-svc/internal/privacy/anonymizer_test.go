package privacy

import (
	"strings"
	"testing"
)

func TestNewAnonymizer(t *testing.T) {
	anonymizer := NewAnonymizer()

	if anonymizer == nil {
		t.Fatal("Expected anonymizer to be created, got nil")
	}

	if anonymizer.emailRegex == nil {
		t.Error("Expected email regex to be initialized")
	}

	if anonymizer.phoneRegex == nil {
		t.Error("Expected phone regex to be initialized")
	}

	if anonymizer.nameRegex == nil {
		t.Error("Expected name regex to be initialized")
	}
}

func TestDefaultAnonymizationOptions(t *testing.T) {
	options := DefaultAnonymizationOptions()

	if options == nil {
		t.Fatal("Expected options to be created, got nil")
	}

	if !options.ReplaceEmails {
		t.Error("Expected ReplaceEmails to be true")
	}

	if !options.ReplacePhones {
		t.Error("Expected ReplacePhones to be true")
	}

	if !options.ReplaceNames {
		t.Error("Expected ReplaceNames to be true")
	}

	if options.SaltForHashing == "" {
		t.Error("Expected salt to be generated")
	}

	if len(options.PlaceholderEmails) == 0 {
		t.Error("Expected placeholder emails to be provided")
	}

	if len(options.PlaceholderNames) == 0 {
		t.Error("Expected placeholder names to be provided")
	}
}

func TestIsEmailAddress(t *testing.T) {
	anonymizer := NewAnonymizer()

	testCases := []struct {
		input    string
		expected bool
	}{
		{"user@example.com", true},
		{"test.email+123@gmail.com", true},
		{"user.name@company.org", true},
		{"invalid-email", false},
		{"@example.com", false},
		{"user@", false},
		{"", false},
		{"user@.com", false},
		{"user@domain", false}, // This might be valid depending on regex, but typically we want domains with TLD
	}

	for _, tc := range testCases {
		result := anonymizer.IsEmailAddress(tc.input)
		if result != tc.expected {
			t.Errorf("IsEmailAddress(%s) = %v, expected %v", tc.input, result, tc.expected)
		}
	}
}

func TestIsPhoneNumber(t *testing.T) {
	anonymizer := NewAnonymizer()

	testCases := []struct {
		input    string
		expected bool
	}{
		{"(555) 123-4567", true},
		{"555-123-4567", true},
		{"555.123.4567", true},
		{"5551234567", true},
		{"1-555-123-4567", true},
		{"+1-555-123-4567", true},
		{"invalid-phone", false},
		{"123", false},
		{"", false},
	}

	for _, tc := range testCases {
		result := anonymizer.IsPhoneNumber(tc.input)
		if result != tc.expected {
			t.Errorf("IsPhoneNumber(%s) = %v, expected %v", tc.input, result, tc.expected)
		}
	}
}

func TestIsPersonalName(t *testing.T) {
	anonymizer := NewAnonymizer()

	testCases := []struct {
		input    string
		expected bool
	}{
		{"John Doe", true},
		{"Jane Smith", true},
		{"Mary Johnson", true},
		{"john doe", false}, // lowercase
		{"JOHN DOE", false}, // uppercase
		{"John", false},     // single name
		{"John Doe Jr", false}, // three words (depends on regex)
		{"", false},
	}

	for _, tc := range testCases {
		result := anonymizer.IsPersonalName(tc.input)
		if result != tc.expected {
			t.Errorf("IsPersonalName(%s) = %v, expected %v", tc.input, result, tc.expected)
		}
	}
}

func TestAnonymizeText_Emails(t *testing.T) {
	anonymizer := NewAnonymizer()
	options := &AnonymizationOptions{
		ReplaceEmails:     true,
		ReplacePhones:     false,
		ReplaceNames:      false,
		PreserveDomains:   false,
		SaltForHashing:    "test-salt",
		PlaceholderEmails: []string{"user1@example.com", "user2@example.com"},
	}

	text := "Please contact user@company.com and admin@test.org for more information."

	result, fieldsAnonymized, err := anonymizer.AnonymizeText(text, options)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if len(fieldsAnonymized) == 0 {
		t.Error("Expected fields to be anonymized")
	}

	if !contains(fieldsAnonymized, "emails") {
		t.Error("Expected 'emails' to be in fields anonymized")
	}

	// Check that original emails are not present
	if strings.Contains(result, "user@company.com") {
		t.Error("Original email should be anonymized")
	}

	if strings.Contains(result, "admin@test.org") {
		t.Error("Original email should be anonymized")
	}

	// Check that placeholders are used
	if !strings.Contains(result, "user1@example.com") && !strings.Contains(result, "user2@example.com") {
		t.Error("Expected placeholder emails to be used")
	}
}

func TestAnonymizeText_Phones(t *testing.T) {
	anonymizer := NewAnonymizer()
	options := &AnonymizationOptions{
		ReplaceEmails: false,
		ReplacePhones: true,
		ReplaceNames:  false,
	}

	text := "Call me at (555) 123-4567 or 555-987-6543."

	result, fieldsAnonymized, err := anonymizer.AnonymizeText(text, options)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if len(fieldsAnonymized) == 0 {
		t.Error("Expected fields to be anonymized")
	}

	if !contains(fieldsAnonymized, "phone_numbers") {
		t.Error("Expected 'phone_numbers' to be in fields anonymized")
	}

	// Check that original phone numbers are not present
	if strings.Contains(result, "(555) 123-4567") {
		t.Error("Original phone number should be anonymized")
	}

	if strings.Contains(result, "555-987-6543") {
		t.Error("Original phone number should be anonymized")
	}

	// Check that placeholder is used
	if !strings.Contains(result, "555-0123") {
		t.Error("Expected placeholder phone number to be used")
	}
}

func TestAnonymizeText_Names(t *testing.T) {
	anonymizer := NewAnonymizer()
	options := &AnonymizationOptions{
		ReplaceEmails:    false,
		ReplacePhones:    false,
		ReplaceNames:     true,
		PlaceholderNames: []string{"John Doe", "Jane Smith"},
	}

	text := "Please speak with Alice Johnson or Bob Wilson about this matter."

	result, fieldsAnonymized, err := anonymizer.AnonymizeText(text, options)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if len(fieldsAnonymized) == 0 {
		t.Error("Expected fields to be anonymized")
	}

	if !contains(fieldsAnonymized, "names") {
		t.Error("Expected 'names' to be in fields anonymized")
	}

	// Check that original names are not present
	if strings.Contains(result, "Alice Johnson") {
		t.Error("Original name should be anonymized")
	}

	if strings.Contains(result, "Bob Wilson") {
		t.Error("Original name should be anonymized")
	}
}

func TestAnonymizeText_PreserveDomains(t *testing.T) {
	anonymizer := NewAnonymizer()
	options := &AnonymizationOptions{
		ReplaceEmails:   true,
		ReplacePhones:   false,
		ReplaceNames:    false,
		PreserveDomains: true,
		SaltForHashing:  "test-salt",
	}

	text := "Contact user@company.com for more information."

	result, _, err := anonymizer.AnonymizeText(text, options)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Should preserve the domain
	if !strings.Contains(result, "@company.com") {
		t.Error("Expected domain to be preserved")
	}

	// Should not contain original username
	if strings.Contains(result, "user@company.com") {
		t.Error("Original email should be anonymized")
	}
}

func TestAnonymizeText_NoMatches(t *testing.T) {
	anonymizer := NewAnonymizer()
	options := DefaultAnonymizationOptions()

	text := "This is a normal text without any sensitive information."

	result, fieldsAnonymized, err := anonymizer.AnonymizeText(text, options)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if len(fieldsAnonymized) != 0 {
		t.Error("Expected no fields to be anonymized")
	}

	if result != text {
		t.Error("Text should remain unchanged when no matches found")
	}
}

func TestAnonymizeField(t *testing.T) {
	anonymizer := NewAnonymizer()
	options := DefaultAnonymizationOptions()

	testCases := []struct {
		fieldType string
		value     string
		shouldChange bool
	}{
		{"email", "user@example.com", true},
		{"email", "not-an-email", false},
		{"phone", "(555) 123-4567", true},
		{"phone", "not-a-phone", false},
		{"name", "John Doe", true},
		{"name", "lowercase name", false},
		{"unknown", "any-value", false},
	}

	for _, tc := range testCases {
		result, err := anonymizer.AnonymizeField(tc.fieldType, tc.value, options)
		if err != nil {
			t.Errorf("Unexpected error for field %s: %v", tc.fieldType, err)
		}

		if tc.shouldChange && result == tc.value {
			t.Errorf("Field %s with value %s should have been anonymized", tc.fieldType, tc.value)
		}

		if !tc.shouldChange && result != tc.value {
			t.Errorf("Field %s with value %s should not have been changed", tc.fieldType, tc.value)
		}
	}
}

func TestGenerateRandomSalt(t *testing.T) {
	salt1 := generateRandomSalt()
	salt2 := generateRandomSalt()

	if salt1 == "" {
		t.Error("Expected salt to be generated")
	}

	if salt2 == "" {
		t.Error("Expected salt to be generated")
	}

	if salt1 == salt2 {
		t.Error("Expected different salts to be generated")
	}

	// Should be hex encoded (length should be even and contain only hex characters)
	if len(salt1)%2 != 0 {
		t.Error("Expected salt to be hex encoded (even length)")
	}
}

func TestHashString(t *testing.T) {
	anonymizer := NewAnonymizer()

	hash1 := anonymizer.hashString("test", "salt1")
	hash2 := anonymizer.hashString("test", "salt1")
	hash3 := anonymizer.hashString("test", "salt2")
	hash4 := anonymizer.hashString("different", "salt1")

	// Same input and salt should produce same hash
	if hash1 != hash2 {
		t.Error("Expected same hash for same input and salt")
	}

	// Different salt should produce different hash
	if hash1 == hash3 {
		t.Error("Expected different hash for different salt")
	}

	// Different input should produce different hash
	if hash1 == hash4 {
		t.Error("Expected different hash for different input")
	}

	// Hash should be hex encoded
	if len(hash1) != 64 { // SHA-256 produces 32 bytes = 64 hex characters
		t.Errorf("Expected hash length to be 64, got %d", len(hash1))
	}
}

func TestAnonymizationWithNilOptions(t *testing.T) {
	anonymizer := NewAnonymizer()

	text := "Contact user@example.com or call (555) 123-4567."

	result, fieldsAnonymized, err := anonymizer.AnonymizeText(text, nil)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Should use default options
	if len(fieldsAnonymized) == 0 {
		t.Error("Expected fields to be anonymized with default options")
	}

	if result == text {
		t.Error("Text should be changed with default options")
	}
}

// Helper function to check if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
