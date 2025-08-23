#!/bin/bash
set -e

echo "Setting up LocalStack KMS for local development..."

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be available..."
while ! curl -s http://localhost:4566/_localstack/health > /dev/null; do
    echo "  LocalStack not ready yet, waiting 2s..."
    sleep 2
done

echo "LocalStack is ready!"

# Create KMS key for PII encryption
echo "Creating KMS key for PII encryption..."
KEY_OUTPUT=$(aws --endpoint-url=http://localhost:4566 \
    --region us-west-2 \
    kms create-key \
    --description "Local development PII encryption key" \
    --query 'KeyMetadata.KeyId' \
    --output text)

if [ $? -eq 0 ]; then
    echo "  Created KMS key: $KEY_OUTPUT"
else
    echo "  Error creating KMS key"
    exit 1
fi

# Create alias for easy reference
echo "Creating KMS alias..."
aws --endpoint-url=http://localhost:4566 \
    --region us-west-2 \
    kms create-alias \
    --alias-name alias/link-app-pii-encryption \
    --target-key-id $KEY_OUTPUT

if [ $? -eq 0 ]; then
    echo "  Created alias: alias/link-app-pii-encryption"
else
    echo "  Error creating alias"
    exit 1
fi

# Test the key works
echo "Testing KMS key functionality..."
TEST_OUTPUT=$(aws --endpoint-url=http://localhost:4566 \
    --region us-west-2 \
    kms generate-data-key \
    --key-id alias/link-app-pii-encryption \
    --key-spec AES_256 \
    --query 'KeyId' \
    --output text)

if [ $? -eq 0 ]; then
    echo "  ✅ KMS key test successful!"
    echo "  Key ID: $TEST_OUTPUT"
else
    echo "  ❌ KMS key test failed"
    exit 1
fi

echo ""
echo "🎉 Local KMS setup complete!"
echo ""
echo "Your user-svc is now configured to use:"
echo "  AWS_KMS_ENDPOINT: http://localhost:4566"  
echo "  AWS_KMS_KEY_ID: alias/link-app-pii-encryption"
echo "  AWS_REGION: us-west-2"
echo ""
echo "All PII data will now be encrypted locally using LocalStack KMS."
echo ""