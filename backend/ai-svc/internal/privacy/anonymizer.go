package privacy

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
)

// Anonymizer provides data anonymization capabilities
type Anonymizer struct {
	emailRegex *regexp.Regexp
	phoneRegex *regexp.Regexp
	nameRegex  *regexp.Regexp
}

// NewAnonymizer creates a new anonymizer instance
func NewAnonymizer() *Anonymizer {
	return &Anonymizer{
		emailRegex: regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`),
		phoneRegex: regexp.MustCompile(`(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})`),
		nameRegex:  regexp.MustCompile(`\b[A-Z][a-z]+\s+[A-Z][a-z]+\b`), // Simple name pattern
	}
}

// AnonymizationOptions configures how data should be anonymized
type AnonymizationOptions struct {
	ReplaceEmails     bool
	ReplacePhones     bool
	ReplaceNames      bool
	PreserveDomains   bool
	SaltForHashing    string
	PlaceholderEmails []string
	PlaceholderNames  []string
}

// DefaultAnonymizationOptions provides sensible defaults
func DefaultAnonymizationOptions() *AnonymizationOptions {
	return &AnonymizationOptions{
		ReplaceEmails:   true,
		ReplacePhones:   true,
		ReplaceNames:    true,
		PreserveDomains: false,
		SaltForHashing:  generateRandomSalt(),
		PlaceholderEmails: []string{
			"user1@example.com",
			"user2@example.com", 
			"user3@example.com",
			"user4@example.com",
			"user5@example.com",
		},
		PlaceholderNames: []string{
			"John Doe",
			"Jane Smith",
			"Alex Johnson",
			"Sarah Wilson",
			"Michael Brown",
			"Emily Davis",
			"David Miller",
			"Lisa Taylor",
		},
	}
}

// AnonymizeText anonymizes sensitive data in text according to the provided options
func (a *Anonymizer) AnonymizeText(text string, options *AnonymizationOptions) (string, []string, error) {
	if options == nil {
		options = DefaultAnonymizationOptions()
	}

	result := text
	fieldsAnonymized := []string{}

	// Anonymize emails
	if options.ReplaceEmails {
		if emailMatches := a.emailRegex.FindAllString(result, -1); len(emailMatches) > 0 {
			fieldsAnonymized = append(fieldsAnonymized, "emails")
			emailReplacements := a.generateEmailReplacements(emailMatches, options)
			
			for original, replacement := range emailReplacements {
				result = strings.ReplaceAll(result, original, replacement)
			}
		}
	}

	// Anonymize phone numbers
	if options.ReplacePhones {
		if phoneMatches := a.phoneRegex.FindAllString(result, -1); len(phoneMatches) > 0 {
			fieldsAnonymized = append(fieldsAnonymized, "phone_numbers")
			result = a.phoneRegex.ReplaceAllStringFunc(result, func(match string) string {
				return a.generatePlaceholderPhone()
			})
		}
	}

	// Anonymize names (basic implementation)
	if options.ReplaceNames {
		if nameMatches := a.nameRegex.FindAllString(result, -1); len(nameMatches) > 0 {
			fieldsAnonymized = append(fieldsAnonymized, "names")
			nameReplacements := a.generateNameReplacements(nameMatches, options)
			
			for original, replacement := range nameReplacements {
				result = strings.ReplaceAll(result, original, replacement)
			}
		}
	}

	return result, fieldsAnonymized, nil
}

// generateEmailReplacements creates consistent email replacements
func (a *Anonymizer) generateEmailReplacements(emails []string, options *AnonymizationOptions) map[string]string {
	replacements := make(map[string]string)
	usedPlaceholders := make(map[string]bool)
	placeholderIndex := 0

	for _, email := range emails {
		// Skip if already processed
		if _, exists := replacements[email]; exists {
			continue
		}

		var replacement string
		
		if options.PreserveDomains {
			// Extract domain and create placeholder with same domain
			parts := strings.Split(email, "@")
			if len(parts) == 2 {
				hashedUser := a.hashString(parts[0], options.SaltForHashing)[:8]
				replacement = fmt.Sprintf("user_%s@%s", hashedUser, parts[1])
			} else {
				replacement = a.getNextPlaceholderEmail(options, usedPlaceholders, &placeholderIndex)
			}
		} else {
			replacement = a.getNextPlaceholderEmail(options, usedPlaceholders, &placeholderIndex)
		}

		replacements[email] = replacement
		usedPlaceholders[replacement] = true
	}

	return replacements
}

// generateNameReplacements creates consistent name replacements
func (a *Anonymizer) generateNameReplacements(names []string, options *AnonymizationOptions) map[string]string {
	replacements := make(map[string]string)
	usedPlaceholders := make(map[string]bool)
	placeholderIndex := 0

	for _, name := range names {
		// Skip if already processed
		if _, exists := replacements[name]; exists {
			continue
		}

		replacement := a.getNextPlaceholderName(options, usedPlaceholders, &placeholderIndex)
		replacements[name] = replacement
		usedPlaceholders[replacement] = true
	}

	return replacements
}

// getNextPlaceholderEmail gets the next available placeholder email
func (a *Anonymizer) getNextPlaceholderEmail(options *AnonymizationOptions, used map[string]bool, index *int) string {
	for *index < len(options.PlaceholderEmails) {
		placeholder := options.PlaceholderEmails[*index]
		*index++
		
		if !used[placeholder] {
			return placeholder
		}
	}

	// If we run out of predefined placeholders, generate new ones
	for {
		generated := fmt.Sprintf("user%d@example.com", *index)
		*index++
		
		if !used[generated] {
			return generated
		}
	}
}

// getNextPlaceholderName gets the next available placeholder name
func (a *Anonymizer) getNextPlaceholderName(options *AnonymizationOptions, used map[string]bool, index *int) string {
	for *index < len(options.PlaceholderNames) {
		placeholder := options.PlaceholderNames[*index]
		*index++
		
		if !used[placeholder] {
			return placeholder
		}
	}

	// If we run out of predefined placeholders, generate new ones
	for {
		generated := fmt.Sprintf("User %d", *index)
		*index++
		
		if !used[generated] {
			return generated
		}
	}
}

// generatePlaceholderPhone generates a placeholder phone number
func (a *Anonymizer) generatePlaceholderPhone() string {
	return "555-0123" // Standard placeholder phone number
}

// hashString creates a consistent hash of a string with salt
func (a *Anonymizer) hashString(input, salt string) string {
	hasher := sha256.New()
	hasher.Write([]byte(input + salt))
	return hex.EncodeToString(hasher.Sum(nil))
}

// generateRandomSalt creates a random salt for hashing
func generateRandomSalt() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// IsEmailAddress checks if a string is likely an email address
func (a *Anonymizer) IsEmailAddress(text string) bool {
	return a.emailRegex.MatchString(text)
}

// IsPhoneNumber checks if a string is likely a phone number
func (a *Anonymizer) IsPhoneNumber(text string) bool {
	return a.phoneRegex.MatchString(text)
}

// IsPersonalName checks if a string is likely a personal name
func (a *Anonymizer) IsPersonalName(text string) bool {
	return a.nameRegex.MatchString(text)
}

// AnonymizeField anonymizes a specific field type
func (a *Anonymizer) AnonymizeField(fieldType, value string, options *AnonymizationOptions) (string, error) {
	if options == nil {
		options = DefaultAnonymizationOptions()
	}

	switch fieldType {
	case "email":
		if options.ReplaceEmails && a.IsEmailAddress(value) {
			replacements := a.generateEmailReplacements([]string{value}, options)
			if replacement, exists := replacements[value]; exists {
				return replacement, nil
			}
		}
		return value, nil

	case "phone":
		if options.ReplacePhones && a.IsPhoneNumber(value) {
			return a.generatePlaceholderPhone(), nil
		}
		return value, nil

	case "name":
		if options.ReplaceNames && a.IsPersonalName(value) {
			replacements := a.generateNameReplacements([]string{value}, options)
			if replacement, exists := replacements[value]; exists {
				return replacement, nil
			}
		}
		return value, nil

	default:
		return value, nil
	}
}
