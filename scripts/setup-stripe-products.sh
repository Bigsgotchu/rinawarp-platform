#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Set consistent region
AWS_REGION="us-west-2"  # Oregon (closest to Utah)
export AWS_DEFAULT_REGION="$AWS_REGION"

# Get Stripe key from SSM
STRIPE_SECRET_KEY=$(aws ssm get-parameter \
    --name "/rinawarp/staging/STRIPE_SECRET_KEY" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text)

if [[ -z "$STRIPE_SECRET_KEY" ]]; then
    echo -e "${RED}Error: Could not get Stripe key from SSM${NC}"
    exit 1
fi

# Function to create a free product
create_free_product() {
    local name=$1
    local description=$2
    local prefix="sk_test_"
    
    # Create product
    product_result=$(curl -s -X POST https://api.stripe.com/v1/products \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "name=${name}" \
        -d "description=${description}")
    
    product_id=$(echo "$product_result" | jq -r '.id')
    
    if [[ "$product_id" == "null" ]]; then
        echo -e "${RED}Error creating product:${NC}" >&2
        echo "$product_result" >&2
        return 1
    fi
    
    echo -e "${GREEN}✓ Created $name product:${NC}" >&2
    echo "Product ID: $product_id" >&2
    
    # Return the product ID
    echo "${product_id}"
}

# Function to create a product and its prices
create_product_with_prices() {
    local name=$1
    local description=$2
    local monthly_price=$3
    local yearly_price=$4
    
    # Create product
    product_result=$(curl -s -X POST https://api.stripe.com/v1/products \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "name=${name}" \
        -d "description=${description}")
    
    product_id=$(echo "$product_result" | jq -r '.id')
    
    if [[ "$product_id" == "null" ]]; then
        echo -e "${RED}Error creating product:${NC}" >&2
        echo "$product_result" >&2
        return 1
    fi
    
    # Create monthly price
    monthly_result=$(curl -s -X POST https://api.stripe.com/v1/prices \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "product=${product_id}" \
        -d "unit_amount=$monthly_price" \
        -d "currency=usd" \
        -d "recurring[interval]=month")
    
    monthly_price_id=$(echo "$monthly_result" | jq -r '.id')
    
    if [[ "$monthly_price_id" == "null" ]]; then
        echo -e "${RED}Error creating monthly price:${NC}" >&2
        echo "$monthly_result" >&2
        return 1
    fi
    
    # Create yearly price (with ~15% discount)
    yearly_result=$(curl -s -X POST https://api.stripe.com/v1/prices \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "product=${product_id}" \
        -d "unit_amount=$yearly_price" \
        -d "currency=usd" \
        -d "recurring[interval]=year")
    
    yearly_price_id=$(echo "$yearly_result" | jq -r '.id')
    
    if [[ "$yearly_price_id" == "null" ]]; then
        echo -e "${RED}Error creating yearly price:${NC}" >&2
        echo "$yearly_result" >&2
        return 1
    fi
    
    echo -e "${GREEN}✓ Created $name product and prices:${NC}" >&2
    echo "Product ID: $product_id" >&2
    echo "Monthly Price ID: $monthly_price_id" >&2
    echo "Yearly Price ID: $yearly_price_id" >&2
    
    # Return the IDs for use in environment config
    echo "${product_id}:${monthly_price_id}:${yearly_price_id}"
}

# Function to update environment config with price IDs
update_env_config() {
    local env=$1
    local free_id=$2
    local pro_ids=$3
    local business_ids=$4
    local enterprise_ids=$5
    
    # Extract IDs
    free_product="$free_id"
    IFS=':' read -r pro_product pro_monthly pro_yearly <<< "$pro_ids"
    IFS=':' read -r business_product business_monthly business_yearly <<< "$business_ids"
    IFS=':' read -r enterprise_product enterprise_monthly enterprise_yearly <<< "$enterprise_ids"
    
    # Create env file
    cat > "config/stripe/${env}.env" << EOF
# Stripe API Configuration - $(tr '[:lower:]' '[:upper:]' <<< ${env:0:1})${env:1}
# Updated on $(date)

# Product IDs
export STRIPE_FREE_PRODUCT_ID="$free_product"
export STRIPE_PRO_PRODUCT_ID="$pro_product"
export STRIPE_BUSINESS_PRODUCT_ID="$business_product"
export STRIPE_ENTERPRISE_PRODUCT_ID="$enterprise_product"

# Price IDs - Professional Plan
export STRIPE_PRO_MONTHLY_PRICE_ID="$pro_monthly"
export STRIPE_PRO_YEARLY_PRICE_ID="$pro_yearly"

# Price IDs - Business Plan
export STRIPE_BUSINESS_MONTHLY_PRICE_ID="$business_monthly"
export STRIPE_BUSINESS_YEARLY_PRICE_ID="$business_yearly"

# Price IDs - Enterprise Plan
export STRIPE_ENTERPRISE_MONTHLY_PRICE_ID="$enterprise_monthly"
export STRIPE_ENTERPRISE_YEARLY_PRICE_ID="$enterprise_yearly"

# Stripe Connect Settings (if using)
# export STRIPE_CLIENT_ID="ca_..."
# export STRIPE_REDIRECT_URI="https://staging.rinawarptech.com/stripe/connect/complete"
EOF
    
    echo -e "${GREEN}✓ Updated ${env} environment configuration${NC}"
}

echo "🛍️ Setting up Stripe products and prices..."

echo -e "\n${YELLOW}Creating Free tier...${NC}"
free_id=$(create_free_product \
    "Free" \
    "Free tier with basic features")

echo -e "\n${YELLOW}Creating Professional tier...${NC}"
pro_ids=$(create_product_with_prices \
    "Professional" \
    "Professional tier with advanced features" \
    "2900" \
    "29900")

echo -e "\n${YELLOW}Creating Business tier...${NC}"
business_ids=$(create_product_with_prices \
    "Business" \
    "Business tier with team features" \
    "7900" \
    "79900")

echo -e "\n${YELLOW}Creating Enterprise tier...${NC}"
enterprise_ids=$(create_product_with_prices \
    "Enterprise" \
    "Enterprise tier with custom features" \
    "19900" \
    "199900")

# Update environment configuration
update_env_config "staging" "$free_id" "$pro_ids" "$business_ids" "$enterprise_ids"

echo -e "\n✅ Stripe setup complete!"
echo -e "Next steps:"
echo "1. Set up webhook endpoints"
echo "2. Configure success/cancel URLs"
echo "3. Test the integration"
