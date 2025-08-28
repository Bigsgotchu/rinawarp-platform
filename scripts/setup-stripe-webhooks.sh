#!/bin/bash

set -euo pipefail

# Load configuration
source config/infrastructure.env

# Set consistent region
AWS_REGION="us-west-2"  # Oregon (closest to Utah)
export AWS_DEFAULT_REGION="$AWS_REGION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to create webhook endpoint
create_webhook_endpoint() {
    local env=$1
    local domain=$2
    local prefix="sk_test_"
    
    if [[ "$env" == "prod" ]]; then
        prefix="sk_live_"
    fi
    
    echo -e "${YELLOW}Creating webhook endpoint for ${env}...${NC}"
    
    # Use the key from SSM
    STRIPE_KEY="$STRIPE_SECRET_KEY"
    
    if [[ ! $STRIPE_KEY =~ ^$prefix ]]; then
        echo -e "${RED}Error: Invalid API key format for ${env}. Must start with ${prefix}${NC}"
        return 1
    fi
    
    # Create webhook endpoint
    local webhook_url="https://${domain}/api/webhooks/stripe"
    echo -e "Creating webhook endpoint at: ${webhook_url}"
    
    webhook_result=$(curl -s -X POST https://api.stripe.com/v1/webhook_endpoints \
        -u "${STRIPE_KEY}:" \
        -d "url=${webhook_url}" \
        -d "enabled_events[]"="customer.subscription.created" \
        -d "enabled_events[]"="customer.subscription.updated" \
        -d "enabled_events[]"="customer.subscription.deleted" \
        -d "enabled_events[]"="customer.subscription.trial_will_end" \
        -d "enabled_events[]"="invoice.payment_succeeded" \
        -d "enabled_events[]"="invoice.payment_failed" \
        -d "enabled_events[]"="customer.created" \
        -d "enabled_events[]"="customer.updated" \
        -d "enabled_events[]"="customer.deleted" \
        -d "enabled_events[]"="payment_method.attached" \
        -d "enabled_events[]"="payment_method.detached" \
        -d "enabled_events[]"="payment_intent.succeeded" \
        -d "enabled_events[]"="payment_intent.payment_failed" \
        -d "enabled_events[]"="account.updated")
    
    webhook_id=$(echo "$webhook_result" | jq -r '.id')
    webhook_secret=$(echo "$webhook_result" | jq -r '.secret')
    
    if [[ "$webhook_id" == "null" || "$webhook_secret" == "null" ]]; then
        echo -e "${RED}Error creating webhook:${NC}"
        echo "$webhook_result"
        return 1
    fi
    
    echo -e "${GREEN}✓ Created webhook endpoint:${NC}"
    echo "Webhook ID: $webhook_id"
    echo "Webhook Secret: $webhook_secret"
    echo "Webhook URL: $webhook_url"
    
    # Update the Stripe config file with webhook details
    local config_file="config/stripe/${env}.env"
    if [[ -f "$config_file" ]]; then
        echo -e "\n# Webhook Configuration" >> "$config_file"
        echo "export STRIPE_WEBHOOK_ID=\"$webhook_id\"" >> "$config_file"
        echo "export STRIPE_WEBHOOK_SECRET=\"$webhook_secret\"" >> "$config_file"
        echo "export STRIPE_WEBHOOK_URL=\"$webhook_url\"" >> "$config_file"
    else
        echo -e "${RED}Warning: Could not find ${config_file} to update${NC}"
    fi
    
    return 0
}

echo "🎣 Setting up Stripe webhook endpoints..."

# Ask which environment to set up
echo -e "${YELLOW}Which environment do you want to set up? (test/prod)${NC}"
read -r ENV

if [[ "$ENV" != "test" && "$ENV" != "prod" ]]; then
    echo -e "${RED}Error: Environment must be 'test' or 'prod'${NC}"
    exit 1
fi

# Set up domain based on environment
if [[ "$ENV" == "test" ]]; then
    create_webhook_endpoint "staging" "staging.rinawarptech.com"
else
    create_webhook_endpoint "production" "rinawarptech.com"
fi

echo -e "\n✅ Webhook setup complete!"
echo -e "Next steps:"
echo "1. Save the webhook secret securely"
echo "2. Implement the webhook handler at /api/webhooks/stripe"
echo "3. Test the webhook with the Stripe CLI"
echo "4. Set up monitoring for webhook failures"

# Example webhook handler code
echo -e "\n${YELLOW}Example webhook handler code:${NC}"
cat << 'EOL'
// Example Node.js webhook handler
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      // ... handle other events
    }
    
    res.json({received: true});
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
EOL
