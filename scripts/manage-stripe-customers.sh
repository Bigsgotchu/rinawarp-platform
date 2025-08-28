#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Set consistent region
AWS_REGION="us-west-2"
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

# Load Stripe product/price IDs
if [[ -f "config/stripe/staging.env" ]]; then
    source config/stripe/staging.env
else
    echo -e "${RED}Error: Could not find Stripe configuration${NC}"
    exit 1
fi

# Function to create a test customer
create_customer() {
    local email=$1
    local name=$2
    
    echo -e "${YELLOW}Creating customer...${NC}" >&2
    
    # Create customer
    customer_result=$(curl -s -X POST https://api.stripe.com/v1/customers \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "email=${email}" \
        -d "name=${name}" \
        -d "description=Test customer" \
        -d "metadata[test]=true")
    
    customer_id=$(echo "$customer_result" | jq -r '.id')
    
    if [[ "$customer_id" == "null" ]]; then
        echo -e "${RED}Error creating customer:${NC}" >&2
        echo "$customer_result" >&2
        return 1
    fi
    
    echo -e "${GREEN}✓ Created customer:${NC}" >&2
    echo "Customer ID: $customer_id" >&2
    
    # Return the customer ID
    echo "$customer_id"
}

# Function to add a payment method
add_payment_method() {
    local customer_id=$1
    
    echo -e "${YELLOW}Adding payment method...${NC}" >&2
    
    # Create test payment method
    payment_result=$(curl -s -X POST https://api.stripe.com/v1/payment_methods \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "type=card" \
        -d "card[number]=4242424242424242" \
        -d "card[exp_month]=12" \
        -d "card[exp_year]=2025" \
        -d "card[cvc]=123")
    
    payment_method_id=$(echo "$payment_result" | jq -r '.id')
    
    if [[ "$payment_method_id" == "null" ]]; then
        echo -e "${RED}Error creating payment method:${NC}" >&2
        echo "$payment_result" >&2
        return 1
    fi
    
    # Attach payment method to customer
    attach_result=$(curl -s -X POST "https://api.stripe.com/v1/payment_methods/${payment_method_id}/attach" \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "customer=${customer_id}")
    
    if [[ "$(echo "$attach_result" | jq -r '.id')" == "null" ]]; then
        echo -e "${RED}Error attaching payment method:${NC}" >&2
        echo "$attach_result" >&2
        return 1
    fi
    
    # Set as default payment method
    update_result=$(curl -s -X POST "https://api.stripe.com/v1/customers/${customer_id}" \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "invoice_settings[default_payment_method]=${payment_method_id}")
    
    if [[ "$(echo "$update_result" | jq -r '.id')" == "null" ]]; then
        echo -e "${RED}Error setting default payment method:${NC}" >&2
        echo "$update_result" >&2
        return 1
    fi
    
    echo -e "${GREEN}✓ Added payment method:${NC}" >&2
    echo "Payment Method ID: $payment_method_id" >&2
    
    # Return the payment method ID
    echo "$payment_method_id"
}

# Function to create a subscription
create_subscription() {
    local customer_id=$1
    local price_id=$2
    local trial_days=${3:-0}
    
    echo -e "${YELLOW}Creating subscription...${NC}" >&2
    
    local trial_params=""
    if [[ "$trial_days" -gt 0 ]]; then
        trial_params="&trial_period_days=${trial_days}"
    fi
    
    # Create subscription
    subscription_result=$(curl -s -X POST https://api.stripe.com/v1/subscriptions \
        -u "${STRIPE_SECRET_KEY}:" \
        -d "customer=${customer_id}" \
        -d "items[0][price]=${price_id}" \
        ${trial_params})
    
    subscription_id=$(echo "$subscription_result" | jq -r '.id')
    
    if [[ "$subscription_id" == "null" ]]; then
        echo -e "${RED}Error creating subscription:${NC}" >&2
        echo "$subscription_result" >&2
        return 1
    fi
    
    echo -e "${GREEN}✓ Created subscription:${NC}" >&2
    echo "Subscription ID: $subscription_id" >&2
    echo "Status: $(echo "$subscription_result" | jq -r '.status')" >&2
    
    # Return the subscription ID
    echo "$subscription_id"
}

# Main menu function
show_menu() {
    echo -e "\n${YELLOW}Test Customer Management${NC}"
    echo "1) Create test customer with free tier"
    echo "2) Create test customer with Professional tier (monthly)"
    echo "3) Create test customer with Professional tier (yearly)"
    echo "4) Create test customer with Business tier (monthly)"
    echo "5) Create test customer with Business tier (yearly)"
    echo "6) Create test customer with Enterprise tier (monthly)"
    echo "7) Create test customer with Enterprise tier (yearly)"
    echo "8) List all test customers"
    echo "9) Exit"
    echo
    read -p "Choose an option: " choice
    
    case $choice in
        1)
            echo -e "\n${YELLOW}Creating test customer with free tier...${NC}"
            read -p "Email: " email
            read -p "Name: " name
            
            customer_id=$(create_customer "$email" "$name")
            add_payment_method "$customer_id"
            ;;
        2)
            echo -e "\n${YELLOW}Creating test customer with Professional tier (monthly)...${NC}"
            read -p "Email: " email
            read -p "Name: " name
            read -p "Trial days (0 for no trial): " trial_days
            
            customer_id=$(create_customer "$email" "$name")
            add_payment_method "$customer_id"
            create_subscription "$customer_id" "$STRIPE_PRO_MONTHLY_PRICE_ID" "$trial_days"
            ;;
        3)
            echo -e "\n${YELLOW}Creating test customer with Professional tier (yearly)...${NC}"
            read -p "Email: " email
            read -p "Name: " name
            read -p "Trial days (0 for no trial): " trial_days
            
            customer_id=$(create_customer "$email" "$name")
            add_payment_method "$customer_id"
            create_subscription "$customer_id" "$STRIPE_PRO_YEARLY_PRICE_ID" "$trial_days"
            ;;
        4)
            echo -e "\n${YELLOW}Creating test customer with Business tier (monthly)...${NC}"
            read -p "Email: " email
            read -p "Name: " name
            read -p "Trial days (0 for no trial): " trial_days
            
            customer_id=$(create_customer "$email" "$name")
            add_payment_method "$customer_id"
            create_subscription "$customer_id" "$STRIPE_BUSINESS_MONTHLY_PRICE_ID" "$trial_days"
            ;;
        5)
            echo -e "\n${YELLOW}Creating test customer with Business tier (yearly)...${NC}"
            read -p "Email: " email
            read -p "Name: " name
            read -p "Trial days (0 for no trial): " trial_days
            
            customer_id=$(create_customer "$email" "$name")
            add_payment_method "$customer_id"
            create_subscription "$customer_id" "$STRIPE_BUSINESS_YEARLY_PRICE_ID" "$trial_days"
            ;;
        6)
            echo -e "\n${YELLOW}Creating test customer with Enterprise tier (monthly)...${NC}"
            read -p "Email: " email
            read -p "Name: " name
            read -p "Trial days (0 for no trial): " trial_days
            
            customer_id=$(create_customer "$email" "$name")
            add_payment_method "$customer_id"
            create_subscription "$customer_id" "$STRIPE_ENTERPRISE_MONTHLY_PRICE_ID" "$trial_days"
            ;;
        7)
            echo -e "\n${YELLOW}Creating test customer with Enterprise tier (yearly)...${NC}"
            read -p "Email: " email
            read -p "Name: " name
            read -p "Trial days (0 for no trial): " trial_days
            
            customer_id=$(create_customer "$email" "$name")
            add_payment_method "$customer_id"
            create_subscription "$customer_id" "$STRIPE_ENTERPRISE_YEARLY_PRICE_ID" "$trial_days"
            ;;
        8)
            echo -e "\n${YELLOW}Listing test customers...${NC}"
            customers=$(curl -s -X GET "https://api.stripe.com/v1/customers?limit=100&expand[]=subscriptions" \
                -u "${STRIPE_SECRET_KEY}:" \
                -G)
            
            if [[ $(echo "$customers" | jq -r '.data | length') -eq 0 ]]; then
                echo "No customers found."
            else
                echo "$customers" | jq -r '.data[] | "ID: \(.id)\nName: \(.name // "<no name>")\nEmail: \(.email // "<no email>")\nSubscriptions: \(if .subscriptions then (.subscriptions.data | map("\(.id) (\(.status))") | join(", ")) else "<none>" end)\n"'
            fi
            ;;
        9)
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
    
    echo -e "\nPress Enter to continue..."
    read
    show_menu
}

# Start the script
echo "🧪 Stripe Test Customer Management"
show_menu
