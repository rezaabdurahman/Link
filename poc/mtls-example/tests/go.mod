module mtls-integration-tests

go 1.21

// No external dependencies needed - using only standard library
// The integration test uses:
// - crypto/tls for mTLS client setup
// - crypto/x509 for certificate validation
// - net/http for HTTP client
// - encoding/json for JSON parsing
// - testing for test framework
