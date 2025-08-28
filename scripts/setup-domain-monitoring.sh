#!/bin/bash

set -euo pipefail

# Default region (Utah -> us-west-2)
AWS_DEFAULT_REGION="us-west-2"
CERT_REGION="us-east-1"  # ACM certificates for CloudFront must be in us-east-1
export AWS_DEFAULT_REGION

# Load configuration
source config/infrastructure.env

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Store certificate ARN
CERT_FILE=$(mktemp)
trap "rm -f $CERT_FILE" EXIT

echo "🔒 Setting up SSL certificates and domain verification..."

# Helper function to safely handle DNS records
handle_dns_record() {
    local NAME=$1
    local TYPE=$2
    local VALUE=$3
    local TTL=$4

    # Check if record exists
    echo "Checking for existing record: $NAME"
    local EXISTING_RECORD
    EXISTING_RECORD=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID_STRIPPED" \
        --query "ResourceRecordSets[?Name=='${NAME}']" \
        --output json | jq -r '.[0]')

    # If record exists
    if [[ "$EXISTING_RECORD" != "null" ]]; then
        local EXISTING_TYPE
        EXISTING_TYPE=$(echo "$EXISTING_RECORD" | jq -r '.Type')
        local EXISTING_VALUE
        EXISTING_VALUE=$(echo "$EXISTING_RECORD" | jq -r '.ResourceRecords[0].Value')

        # If different type or value, delete first
        if [[ "$EXISTING_TYPE" != "$TYPE" || "$EXISTING_VALUE" != "$VALUE" ]]; then
            echo "Deleting existing record with different value..."
            cat > delete-record.json << EOL
{
    "Changes": [
        {
            "Action": "DELETE",
            "ResourceRecordSet": $EXISTING_RECORD
        }
    ]
}
EOL
            aws route53 change-resource-record-sets \
                --hosted-zone-id "$HOSTED_ZONE_ID_STRIPPED" \
                --change-batch file://delete-record.json
            rm -f delete-record.json
        else
            echo "Record exists with correct value, skipping..."
            return 0
        fi
    fi

    # Create new record
    echo "Creating new record..."
    cat > create-record.json << EOL
{
    "Changes": [
        {
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": "$NAME",
                "Type": "$TYPE",
                "TTL": $TTL,
                "ResourceRecords": [{ "Value": "$VALUE" }]
            }
        }
    ]
}
EOL
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID_STRIPPED" \
        --change-batch file://create-record.json
    rm -f create-record.json
}

# Request wildcard certificate
echo "Requesting SSL certificate..."
aws acm request-certificate \
    --region "$CERT_REGION" \
    --domain-name "$PRODUCTION_DOMAIN" \
    --validation-method DNS \
    --subject-alternative-names \
        "*.$PRODUCTION_DOMAIN" \
        "$STAGING_DOMAIN" \
        "$PREVIEW_DOMAIN" \
        "$DEV_DOMAIN" \
        "$QA_DOMAIN" \
        "$E2E_DOMAIN" \
        "$CI_DOMAIN" \
    --query 'CertificateArn' \
    --output text > "$CERT_FILE"

CERT_ARN=$(cat "$CERT_FILE")

# Wait for certificate validation records
echo "Waiting for validation records..."
sleep 10

# Strip /hostedzone/ prefix from Zone ID
HOSTED_ZONE_ID_STRIPPED=$(echo "$AWS_ROUTE53_ZONE_ID" | sed 's#.*/##')

# Get validation records
echo "Getting validation records..."
VALIDATION_RECORDS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$CERT_REGION" \
    --query 'Certificate.DomainValidationOptions[].ResourceRecord[]' \
    --output json)

# Process each validation record
echo "Processing validation records..."
for record in $(echo "$VALIDATION_RECORDS" | jq -c '.[]'); do
    NAME=$(echo "$record" | jq -r '.Name')
    TYPE=$(echo "$record" | jq -r '.Type')
    VALUE=$(echo "$record" | jq -r '.Value')
    handle_dns_record "$NAME" "$TYPE" "$VALUE" 300
done

rm -f validation-records.json

echo "🔔 Setting up monitoring and notifications..."

# Add email subscription to SNS topic
echo -e "${YELLOW}Enter notification email address: ${NC}"
read -r EMAIL_ADDRESS

aws sns subscribe \
    --topic-arn "$AWS_SNS_TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$EMAIL_ADDRESS"

echo "✉️ Please check your email to confirm the subscription"

# Create CloudWatch dashboards for each environment
echo "Creating CloudWatch dashboards..."
for ENV in production staging preview dev qa e2e ci; do
    cat > "dashboard-${ENV}.json" << EOL
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/ApplicationELB", "RequestCount", "LoadBalancer", "rinawarp-${ENV}" ]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "us-west-2",
                "title": "${ENV^} Request Count"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", "rinawarp-${ENV}" ]
                ],
                "period": 300,
                "stat": "Sum",
                "region": "us-west-2",
                "title": "${ENV^} Error Count"
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "rinawarp-${ENV}" ]
                ],
                "period": 300,
                "stat": "Average",
                "region": "us-west-2",
                "title": "${ENV^} Response Time"
            }
        }
    ]
}
EOL

    aws cloudwatch put-dashboard \
        --dashboard-name "RinaWarp-${ENV}" \
        --dashboard-body "file://dashboard-${ENV}.json"
    
    rm -f "dashboard-${ENV}.json"

    # Create alarms
    aws cloudwatch put-metric-alarm \
        --alarm-name "RinaWarp-${ENV}-HighErrorRate" \
        --metric-name "HTTPCode_Target_5XX_Count" \
        --namespace "AWS/ApplicationELB" \
        --statistic "Sum" \
        --period 300 \
        --threshold 10 \
        --comparison-operator "GreaterThanThreshold" \
        --evaluation-periods 2 \
        --alarm-actions "$AWS_SNS_TOPIC_ARN" \
        --dimensions "Name=LoadBalancer,Value=rinawarp-${ENV}"
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "RinaWarp-${ENV}-HighLatency" \
        --metric-name "TargetResponseTime" \
        --namespace "AWS/ApplicationELB" \
        --statistic "Average" \
        --period 300 \
        --threshold 5 \
        --comparison-operator "GreaterThanThreshold" \
        --evaluation-periods 3 \
        --alarm-actions "$AWS_SNS_TOPIC_ARN" \
        --dimensions "Name=LoadBalancer,Value=rinawarp-${ENV}"
done

# Update environment variables
echo "Updating environment configuration..."
cat >> config/infrastructure.env << EOL

# SSL Certificate
export AWS_CERTIFICATE_ARN="$CERT_ARN"

# Monitoring Configuration
export AWS_NOTIFICATION_EMAIL="$EMAIL_ADDRESS"
export AWS_CLOUDWATCH_RETENTION_DAYS="30"
EOL

echo -e "
✅ Domain and monitoring setup complete!

Domain Configuration:
- SSL certificate requested: $CERT_ARN
- DNS validation records added
- Certificate covers all subdomains

Monitoring Setup:
- Email notifications: $EMAIL_ADDRESS
- CloudWatch dashboards created
- Error rate alarms configured
- Response time alarms configured

Next Steps:
1. Check your email to confirm SNS subscription
2. Wait for SSL certificate validation (can take up to 30 minutes)
3. Check CloudWatch dashboards:
   https://console.aws.amazon.com/cloudwatch/home#dashboards:
4. View Route53 records:
   https://console.aws.amazon.com/route53/v2/hostedzones#

Would you like to proceed with the next step? (y/n)"
