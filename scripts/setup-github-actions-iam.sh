#!/bin/bash

# Exit on error
set -e

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Create a temporary file for credentials
CREDS_FILE=$(mktemp)
trap "rm -f $CREDS_FILE" EXIT

echo "Creating IAM policy..."
POLICY_ARN=$(aws iam create-policy \
    --policy-name RinawarpGitHubActionsPolicy \
    --policy-document file://infrastructure/iam/github-actions-policy.json \
    --query 'Policy.Arn' \
    --output text)

echo "Creating IAM user..."
aws iam create-user --user-name rinawarp-github-actions

echo "Attaching policy to user..."
aws iam attach-user-policy \
    --user-name rinawarp-github-actions \
    --policy-arn "$POLICY_ARN"

echo "Creating access key..."
aws iam create-access-key \
    --user-name rinawarp-github-actions \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
    --output text > "$CREDS_FILE"

# Read credentials
ACCESS_KEY_ID=$(head -n 1 "$CREDS_FILE")
SECRET_ACCESS_KEY=$(tail -n 1 "$CREDS_FILE")

echo ""
echo "Created IAM user with restricted permissions."
echo ""
echo "To add these credentials to GitHub:"
echo ""
echo "1. Go to your GitHub repository settings"
echo "2. Navigate to Settings > Secrets and variables > Actions"
echo "3. Add the following secrets:"
echo ""
echo "AWS_ACCESS_KEY_ID: $ACCESS_KEY_ID"
echo "AWS_SECRET_ACCESS_KEY: $SECRET_ACCESS_KEY"
echo ""
echo "IMPORTANT: These credentials are only shown once and have been saved to:"
echo "$CREDS_FILE"
echo ""
echo "After adding them to GitHub, delete this file immediately!"
echo ""
echo "Would you like me to open the GitHub secrets page? (y/n)"
read -r OPEN_BROWSER

if [[ $OPEN_BROWSER =~ ^[Yy]$ ]]; then
    open "https://github.com/Bigsgotchu/rinawarp/settings/secrets/actions"
fi
