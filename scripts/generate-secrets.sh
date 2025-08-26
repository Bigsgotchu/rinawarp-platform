#!/bin/bash

# Function to generate a secure random string
generate_secret() {
  LENGTH=${1:-32}
  LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$LENGTH"
}

# Function to generate a password with special characters
generate_password() {
  LENGTH=${1:-32}
  LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' < /dev/urandom | head -c "$LENGTH"
}

# Create secrets directory if it doesn't exist
SECRETS_DIR="k8s/production/secrets"
mkdir -p "$SECRETS_DIR"

# Generate PostgreSQL secrets
cat > "$SECRETS_DIR/postgres-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secrets
  namespace: rinawarp
type: Opaque
stringData:
  database: rinawarp
  username: rinawarp_admin
  password: $(generate_password 32)
EOF

# Generate Redis secrets
cat > "$SECRETS_DIR/redis-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: redis-secrets
  namespace: rinawarp
type: Opaque
stringData:
  password: $(generate_password 32)
EOF

# Generate platform secrets
cat > "$SECRETS_DIR/platform-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: platform-secrets
  namespace: rinawarp
type: Opaque
stringData:
  JWT_SECRET: $(generate_secret 64)
  SESSION_SECRET: $(generate_secret 64)
  STRIPE_SECRET_KEY: "PLACEHOLDER"
  STRIPE_WEBHOOK_SECRET: "PLACEHOLDER"
  AI_API_KEY: "PLACEHOLDER"
  SENTRY_DSN: "PLACEHOLDER"
  SLACK_WEBHOOK_URL: "PLACEHOLDER"
EOF

# Generate monitoring secrets
cat > "$SECRETS_DIR/monitoring-secrets.yaml" << EOF
apiVersion: v1
kind: Secret
metadata:
  name: monitoring-secrets
  namespace: rinawarp
type: Opaque
stringData:
  grafana-admin-password: $(generate_password 16)
  slack-webhook-url: "PLACEHOLDER"
EOF

# Create a .env file for local development
cat > .env.production << EOF
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
API_URL=https://api.rinawarptech.com
WEBSITE_URL=https://rinawarptech.com

# Authentication
JWT_SECRET=$(generate_secret 64)
JWT_EXPIRATION=24h
SESSION_SECRET=$(generate_secret 64)

# Database
DATABASE_URL=postgresql://rinawarp_admin:$(generate_password 32)@postgres:5432/rinawarp
REDIS_URL=redis://redis:6379

# AI Service
AI_SERVICE_URL=https://ai.rinawarptech.com
AI_API_KEY=PLACEHOLDER

# Stripe
STRIPE_SECRET_KEY=PLACEHOLDER
STRIPE_WEBHOOK_SECRET=PLACEHOLDER
STRIPE_PRO_MONTHLY_PRICE_ID=PLACEHOLDER
STRIPE_PRO_YEARLY_PRICE_ID=PLACEHOLDER
STRIPE_TURBO_MONTHLY_PRICE_ID=PLACEHOLDER
STRIPE_TURBO_YEARLY_PRICE_ID=PLACEHOLDER
STRIPE_BUSINESS_MONTHLY_PRICE_ID=PLACEHOLDER
STRIPE_BUSINESS_YEARLY_PRICE_ID=PLACEHOLDER

# Monitoring
SENTRY_DSN=PLACEHOLDER
METRICS_INTERVAL=60000
METRICS_RETENTION=86400
EOF

echo "Generated secrets in $SECRETS_DIR/"
echo "Created .env.production with secure values"
echo ""
echo "IMPORTANT: Replace all PLACEHOLDER values with actual secrets before deploying"
echo "The following values need to be replaced:"
echo "- Stripe API keys and price IDs"
echo "- AI service API key"
echo "- Sentry DSN"
echo "- Slack webhook URLs"
