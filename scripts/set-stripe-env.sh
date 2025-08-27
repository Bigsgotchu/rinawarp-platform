#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Display help
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    echo "Usage: $0 <secret_key> <public_key> <webhook_secret>"
    echo "Example: $0 sk_test_xxx pk_test_yyy whsec_zzz"
    exit 0
fi

# Check arguments
if [ $# -ne 3 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 <secret_key> <public_key> <webhook_secret>"
    echo "Example: $0 sk_test_xxx pk_test_yyy whsec_zzz"
    exit 1
fi

STRIPE_SECRET_KEY=$1
STRIPE_PUBLIC_KEY=$2
STRIPE_WEBHOOK_SECRET=$3

echo -e "${YELLOW}Stripe Environment Setup${NC}\n"

# Create directories if they don't exist
mkdir -p backups reports

# Validate keys
if [[ ! $STRIPE_SECRET_KEY =~ ^sk_test_ ]]; then
    echo -e "${RED}Error: Invalid secret key format. Must start with 'sk_test_'${NC}"
    exit 1
fi

if [[ ! $STRIPE_PUBLIC_KEY =~ ^pk_test_ ]]; then
    echo -e "${RED}Error: Invalid public key format. Must start with 'pk_test_'${NC}"
    exit 1
fi

if [[ ! $STRIPE_WEBHOOK_SECRET =~ ^whsec_ ]]; then
    echo -e "${RED}Error: Invalid webhook secret format. Must start with 'whsec_'${NC}"
    exit 1
fi

# Update .env.test file
cat > packages/api/.env.test << EOL
# Test Environment Configuration

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rinawarp_test?schema=public"

# Stripe Test Configuration
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}"
STRIPE_PUBLIC_KEY="${STRIPE_PUBLIC_KEY}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}"

# Server Configuration
PORT=3001
HOST="localhost"
NODE_ENV="test"

# JWT Security (Test only - do not use in production)
JWT_SECRET="test_jwt_secret_key"
JWT_EXPIRY="15m"
REFRESH_TOKEN_EXPIRY="7d"

# CORS
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging
LOG_LEVEL="debug"
EOL

# Export variables for current session
export STRIPE_SECRET_KEY
export STRIPE_PUBLIC_KEY
export STRIPE_WEBHOOK_SECRET

# Make all scripts executable
chmod +x scripts/*.sh 2>/dev/null || true

echo -e "\n${GREEN}Environment setup complete!${NC}"
echo -e "Environment variables exported and saved to packages/api/.env.test"
echo -e "\nYou can now run:"
echo -e "  ${YELLOW}./scripts/deploy-test.sh${NC}"
