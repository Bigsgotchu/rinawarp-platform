#!/bin/bash

set -euo pipefail

# Store temp config files securely
CONFIG_FILE=$(mktemp)
CREDS_FILE=$(mktemp)
trap "rm -f $CONFIG_FILE $CREDS_FILE" EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 not found${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ $1 found${NC}"
    return 0
}

prompt_value() {
    local VAR_NAME=$1
    local DESCRIPTION=$2
    local DEFAULT=${3:-}
    local PROMPT="Enter $DESCRIPTION"
    [[ -n "$DEFAULT" ]] && PROMPT+=" (default: $DEFAULT)"
    PROMPT+=": "
    
    read -p "$PROMPT" VALUE
    VALUE=${VALUE:-$DEFAULT}
    
    # Export the variable
    export "$VAR_NAME=$VALUE"
}

# 1. Check required tools
echo "Checking required tools..."
MISSING_TOOLS=0

for tool in aws gh stripe jq curl; do
    if ! check_command "$tool"; then
        MISSING_TOOLS=1
        case $tool in
            "aws")
                echo "Install AWS CLI: brew install awscli"
                ;;
            "gh")
                echo "Install GitHub CLI: brew install gh"
                ;;
            "stripe")
                echo "Install Stripe CLI: brew install stripe/stripe-cli/stripe"
                ;;
            "jq")
                echo "Install jq: brew install jq"
                ;;
        esac
    fi
done

[[ $MISSING_TOOLS -eq 1 ]] && exit 1

# 2. Verify AWS credentials
echo -e "\nChecking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Run 'aws configure' to set up credentials"
    exit 1
fi

echo -e "${GREEN}✓ AWS credentials configured${NC}"

# 3. Check GitHub authentication
echo -e "\nChecking GitHub authentication..."
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI not authenticated${NC}"
    echo "Run 'gh auth login' to authenticate"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI authenticated${NC}"

# 4. Check Stripe CLI authentication
echo -e "\nChecking Stripe CLI authentication..."
if ! stripe config &> /dev/null; then
    echo -e "${RED}❌ Stripe CLI not authenticated${NC}"
    echo "Run 'stripe login' to authenticate"
    exit 1
fi

echo -e "${GREEN}✓ Stripe CLI authenticated${NC}"

# 5. Collect AWS infrastructure details
echo -e "\nCollecting AWS infrastructure details..."

# Get VPC ID
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=isDefault,Values=true" \
    --query "Vpcs[0].VpcId" \
    --output text)

# Get subnets
SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query "Subnets[?MapPublicIpOnLaunch==\`true\`].SubnetId" \
    --output text)

# Get or create security group
SG_NAME="rinawarp-lb-sg"
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SG_NAME" \
    --query "SecurityGroups[0].GroupId" \
    --output text)

if [[ "$SG_ID" == "None" ]]; then
    echo "Creating security group..."
    SG_ID=$(aws ec2 create-security-group \
        --group-name "$SG_NAME" \
        --description "Security group for RinaWarp load balancers" \
        --vpc-id "$VPC_ID" \
        --query "GroupId" \
        --output text)
    
    # Add inbound rules
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress \
        --group-id "$SG_ID" \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0
fi

# Get hosted zone
ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='rinawarptech.com.'].Id" \
    --output text)

if [[ -z "$ZONE_ID" ]]; then
    echo "Creating hosted zone..."
    ZONE_ID=$(aws route53 create-hosted-zone \
        --name "rinawarptech.com" \
        --caller-reference "$(date +%s)" \
        --query "HostedZone.Id" \
        --output text)
fi

# Create SNS topic for alerts
TOPIC_ARN=$(aws sns create-topic \
    --name "RinaWarp-Alerts" \
    --query "TopicArn" \
    --output text)

# 6. Save configuration
cat > config/infrastructure.env << EOL
# AWS Infrastructure Configuration
export AWS_VPC_ID="$VPC_ID"
export AWS_SUBNET_1="$(echo $SUBNETS | cut -d' ' -f1)"
export AWS_SUBNET_2="$(echo $SUBNETS | cut -d' ' -f2)"
export AWS_SECURITY_GROUP_ID="$SG_ID"
export AWS_ROUTE53_ZONE_ID="$ZONE_ID"
export AWS_SNS_TOPIC_ARN="$TOPIC_ARN"

# Environment Domain Names
export PRODUCTION_DOMAIN="rinawarptech.com"
export STAGING_DOMAIN="staging.rinawarptech.com"
export PREVIEW_DOMAIN="preview.rinawarptech.com"
export DEV_DOMAIN="dev.rinawarptech.com"
export QA_DOMAIN="qa.rinawarptech.com"
export E2E_DOMAIN="e2e.rinawarptech.com"
export CI_DOMAIN="ci.rinawarptech.com"

# GitHub Configuration
export GITHUB_REPO="Bigsgotchu/rinawarp"
export GITHUB_BRANCH_MAIN="main"
export GITHUB_BRANCH_DEVELOP="develop"

# Stripe Configuration
export STRIPE_API_VERSION="2023-10-16"
export STRIPE_WEBHOOK_TOLERANCE="300"
EOL

echo -e "\n${GREEN}✅ Prerequisites setup complete!${NC}"
echo -e "Configuration saved to ${YELLOW}config/infrastructure.env${NC}"
echo ""
echo "Next steps:"
echo "1. Review configuration in config/infrastructure.env"
echo "2. Run DNS verification for your domain"
echo "3. Configure Stripe webhook endpoints"
echo "4. Run the complete environment setup script"
echo ""
echo -e "${YELLOW}Would you like to proceed with environment setup? (y/n)${NC}"
read -r PROCEED

if [[ "$PROCEED" =~ ^[Yy]$ ]]; then
    source config/infrastructure.env
    ./scripts/complete-environment-setup.sh
else
    echo "You can run the setup later with:"
    echo "source config/infrastructure.env && ./scripts/complete-environment-setup.sh"
fi
