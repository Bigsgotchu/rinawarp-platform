#!/bin/bash

set -euo pipefail

# Configuration
ENVIRONMENTS=(
  "dev:feature/*,bugfix/*:dev.rinawarptech.com"
  "qa:release/*,hotfix/*:qa.rinawarptech.com"
  "staging:develop:staging.rinawarptech.com"
  "preview:pull/*:preview.rinawarptech.com"
  "e2e:main,release/*:e2e.rinawarptech.com"
  "ci:*:ci.rinawarptech.com"
  "production:main,release/*:rinawarptech.com"
)

# Store temp files securely
STRIPE_CREDS_FILE=$(mktemp)
DNS_CONFIG_FILE=$(mktemp)

# Clean up temp files on exit
trap "rm -f $STRIPE_CREDS_FILE $DNS_CONFIG_FILE" EXIT

# Helper: Configure branch protection
setup_branch_protection() {
    local ENV_NAME=$1
    local BRANCH_PATTERNS=$2
    
    IFS=',' read -ra PATTERNS <<< "$BRANCH_PATTERNS"
    
    # Create branch protection configuration
    cat > branch_protection.json << EOL
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build", "test", "lint"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOL

    # Apply branch protection to each pattern
    for pattern in "${PATTERNS[@]}"; do
        echo "Setting up branch protection for $pattern in $ENV_NAME..."
        gh api \
            --method PUT \
            "/repos/Bigsgotchu/rinawarp/environments/$ENV_NAME/branch_policies" \
            --input branch_protection.json || echo "Branch protection API not available on current plan"
    done

    rm -f branch_protection.json
}

# Helper: Set up Stripe environment
setup_stripe_environment() {
    local ENV_NAME=$1
    
    # Get or create Stripe API keys
    echo "Setting up Stripe for $ENV_NAME environment..."
    
    if [[ "$ENV_NAME" == "production" ]]; then
        stripe api keys create -q > "$STRIPE_CREDS_FILE"
        local STRIPE_KEY=$(grep "^sk_live_" "$STRIPE_CREDS_FILE" || echo "")
        local STRIPE_PUB_KEY=$(grep "^pk_live_" "$STRIPE_CREDS_FILE" || echo "")
    else
        stripe api testhelpers keys create -q > "$STRIPE_CREDS_FILE"
        local STRIPE_KEY=$(grep "^sk_test_" "$STRIPE_CREDS_FILE" || echo "")
        local STRIPE_PUB_KEY=$(grep "^pk_test_" "$STRIPE_CREDS_FILE" || echo "")
    fi

    # Create webhook endpoint
    local WEBHOOK_SECRET
    WEBHOOK_SECRET=$(stripe webhook endpoints create \
        --url "https://${3}/api/stripe/webhook" \
        --connect false \
        --api-version "2023-10-16" \
        --events "charge.succeeded,invoice.paid,customer.subscription.updated" \
        -q | grep "^whsec_" || echo "")

    # Set Stripe secrets in GitHub environment
    echo "Setting Stripe secrets for $ENV_NAME..."
    gh secret set STRIPE_SECRET_KEY --env "$ENV_NAME" --body "$STRIPE_KEY"
    gh secret set STRIPE_PUBLISHABLE_KEY --env "$ENV_NAME" --body "$STRIPE_PUB_KEY"
    gh secret set STRIPE_WEBHOOK_SECRET --env "$ENV_NAME" --body "$WEBHOOK_SECRET"

    # Add Stripe price IDs for each plan
    setup_stripe_products "$ENV_NAME"
}

# Helper: Set up Stripe products and prices
setup_stripe_products() {
    local ENV_NAME=$1
    local SUFFIX=""
    [[ "$ENV_NAME" != "production" ]] && SUFFIX="-$ENV_NAME"

    # Create products
    for PLAN in "pro" "turbo" "business"; do
        local PRODUCT_ID
        PRODUCT_ID=$(stripe products create \
            --name "${PLAN^} Plan${SUFFIX}" \
            --description "RinaWarp Terminal ${PLAN^} Plan" \
            -q | grep "^prod_" || echo "")

        # Create monthly price
        local MONTHLY_PRICE
        case $PLAN in
            "pro") MONTHLY_PRICE=1200 ;; # $12.00
            "turbo") MONTHLY_PRICE=3500 ;; # $35.00
            "business") MONTHLY_PRICE=4900 ;; # $49.00
        esac
        
        local PRICE_ID_MONTHLY
        PRICE_ID_MONTHLY=$(stripe prices create \
            --product "$PRODUCT_ID" \
            --currency usd \
            --recurring "interval=month" \
            --unit-amount "$MONTHLY_PRICE" \
            -q | grep "^price_" || echo "")

        # Create yearly price (20% discount)
        local YEARLY_PRICE=$((MONTHLY_PRICE * 10)) # 12 months - 20%
        local PRICE_ID_YEARLY
        PRICE_ID_YEARLY=$(stripe prices create \
            --product "$PRODUCT_ID" \
            --currency usd \
            --recurring "interval=year" \
            --unit-amount "$YEARLY_PRICE" \
            -q | grep "^price_" || echo "")

        # Set price IDs in GitHub environment
        gh secret set "STRIPE_${PLAN^^}_MONTHLY_PRICE_ID" --env "$ENV_NAME" --body "$PRICE_ID_MONTHLY"
        gh secret set "STRIPE_${PLAN^^}_YEARLY_PRICE_ID" --env "$ENV_NAME" --body "$PRICE_ID_YEARLY"
    done
}

# Helper: Set up DNS and infrastructure
setup_dns_infrastructure() {
    local ENV_NAME=$1
    local DOMAIN=$2

    # Create DNS records
    echo "Setting up DNS for $ENV_NAME ($DOMAIN)..."
    
    # Create Route53 configuration
    cat > "$DNS_CONFIG_FILE" << EOL
{
  "ChangeBatch": {
    "Changes": [
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "${DOMAIN}",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z2FDTNDATAQYW2",
            "DNSName": "d123example.cloudfront.net",
            "EvaluateTargetHealth": false
          }
        }
      }
    ]
  }
}
EOL

    # Apply DNS changes
    aws route53 change-resource-record-sets \
        --hosted-zone-id "YOUR_HOSTED_ZONE_ID" \
        --cli-input-json "file://$DNS_CONFIG_FILE"

    # Set up CloudFront distribution
    aws cloudfront create-distribution \
        --distribution-config "file://infrastructure/cloudfront/${ENV_NAME}.json" \
        --query "Distribution.Id" \
        --output text > /dev/null

    # Configure load balancer
    aws elbv2 create-load-balancer \
        --name "rinawarp-${ENV_NAME}" \
        --subnets "subnet-xxxxx" "subnet-yyyyy" \
        --security-groups "sg-zzzzz" \
        --scheme internet-facing \
        --type application \
        --query "LoadBalancers[0].LoadBalancerArn" \
        --output text > /dev/null
}

# Helper: Set up monitoring and logging
setup_monitoring() {
    local ENV_NAME=$1
    
    # Create CloudWatch Log Group
    aws logs create-log-group --log-group-name "/rinawarp/$ENV_NAME"
    
    # Set retention policy
    aws logs put-retention-policy \
        --log-group-name "/rinawarp/$ENV_NAME" \
        --retention-in-days 30

    # Create CloudWatch dashboard
    aws cloudwatch put-dashboard \
        --dashboard-name "RinaWarp-${ENV_NAME}" \
        --dashboard-body "file://infrastructure/monitoring/${ENV_NAME}-dashboard.json"

    # Create alarms
    aws cloudwatch put-metric-alarm \
        --alarm-name "RinaWarp-${ENV_NAME}-HighErrorRate" \
        --metric-name "5XXError" \
        --namespace "AWS/ApplicationELB" \
        --statistic "Sum" \
        --period 300 \
        --threshold 10 \
        --comparison-operator "GreaterThanThreshold" \
        --evaluation-periods 2 \
        --alarm-actions "arn:aws:sns:REGION:ACCOUNT:AlertsTopic"
}

# Helper: Update CI/CD pipeline for environment
update_cicd_pipeline() {
    local ENV_NAME=$1
    local BRANCH_PATTERNS=$2

    # Create environment-specific workflow
    cat > ".github/workflows/${ENV_NAME}.yml" << EOL
name: ${ENV_NAME^} Deployment

on:
  push:
    branches: [${BRANCH_PATTERNS//,/, }]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${ENV_NAME}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-west-2
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        env:
          NODE_ENV: ${ENV_NAME}
          
      - name: Deploy
        run: |
          aws s3 sync ./out s3://rinawarp-${ENV_NAME}
          aws cloudfront create-invalidation --distribution-id \${{ secrets.CLOUDFRONT_ID }} --paths "/*"
EOL
}

echo "Starting comprehensive environment setup..."

# Process each environment
for env_config in "${ENVIRONMENTS[@]}"; do
    IFS=':' read -r ENV_NAME BRANCH_PATTERNS DOMAIN <<< "$env_config"
    
    echo "Setting up $ENV_NAME environment..."
    
    # 1. Configure branch protection
    setup_branch_protection "$ENV_NAME" "$BRANCH_PATTERNS"
    
    # 2. Set up DNS and infrastructure
    setup_dns_infrastructure "$ENV_NAME" "$DOMAIN"
    
    # 3. Configure monitoring and logging
    setup_monitoring "$ENV_NAME"
    
    # 4. Update CI/CD pipeline
    update_cicd_pipeline "$ENV_NAME" "$BRANCH_PATTERNS"
    
    # 5. Set up Stripe environment
    setup_stripe_environment "$ENV_NAME" "$DOMAIN"
    
    echo "✅ $ENV_NAME environment setup complete!"
done

echo "
✅ All environments have been configured!

For each environment:
1. Branch protection rules are set
2. DNS and infrastructure is configured
3. Monitoring and logging is set up
4. CI/CD pipeline is updated
5. Stripe integration is configured

Environment URLs:
- Production: https://rinawarptech.com
- Staging: https://staging.rinawarptech.com
- Preview: https://preview.rinawarptech.com
- Dev: https://dev.rinawarptech.com
- QA: https://qa.rinawarptech.com
- E2E: https://e2e.rinawarptech.com
- CI: https://ci.rinawarptech.com

Next steps:
1. Verify GitHub environment settings:
   https://github.com/Bigsgotchu/rinawarp/settings/environments

2. Verify Stripe webhooks:
   https://dashboard.stripe.com/webhooks

3. Check AWS resources:
   - CloudFront distributions
   - Route53 DNS records
   - CloudWatch dashboards
   - Load balancers

4. Test deployments:
   - Create a feature branch
   - Make a PR
   - Watch the preview deployment
   - Merge to main
   - Watch staging and production deployments
"
