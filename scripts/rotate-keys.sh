#!/bin/bash

set -euo pipefail

# Store credentials in secure temporary files
STAGING_CREDS=$(mktemp)
PROD_CREDS=$(mktemp)

# Ensure we clean up temp files
trap "rm -f $STAGING_CREDS $PROD_CREDS" EXIT

echo "Rotating staging user keys..."
aws iam delete-access-key --user-name rinawarp-github-actions-staging --access-key-id AKIA2PML2YYGUVXW5OEX
aws iam delete-access-key --user-name rinawarp-github-actions-staging --access-key-id AKIA2PML2YYGUAFXSNSR

echo "Creating new staging key..."
aws iam create-access-key --user-name rinawarp-github-actions-staging \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
  --output text > "$STAGING_CREDS"

echo "Rotating production user keys..."
aws iam delete-access-key --user-name rinawarp-github-actions-prod --access-key-id AKIA2PML2YYGZYIJRPP7
aws iam delete-access-key --user-name rinawarp-github-actions-prod --access-key-id AKIA2PML2YYGXNNTSWE5

echo "Creating new production key..."
aws iam create-access-key --user-name rinawarp-github-actions-prod \
  --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
  --output text > "$PROD_CREDS"

# Read new credentials
STAGING_KEY_ID=$(head -n 1 "$STAGING_CREDS")
STAGING_SECRET=$(tail -n 1 "$STAGING_CREDS")
PROD_KEY_ID=$(head -n 1 "$PROD_CREDS")
PROD_SECRET=$(tail -n 1 "$PROD_CREDS")

echo "Adding new credentials to GitHub environments..."

# Add staging secrets
echo "Setting staging environment secrets..."
gh secret set AWS_ACCESS_KEY_ID --env staging --body "$STAGING_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --env staging --body "$STAGING_SECRET"

# Add production secrets
echo "Setting production environment secrets..."
gh secret set AWS_ACCESS_KEY_ID --env production --body "$PROD_KEY_ID"
gh secret set AWS_SECRET_ACCESS_KEY --env production --body "$PROD_SECRET"

echo "
✅ Key rotation complete!

New staging credentials:
AWS_ACCESS_KEY_ID=$STAGING_KEY_ID
AWS_SECRET_ACCESS_KEY=$STAGING_SECRET

New production credentials:
AWS_ACCESS_KEY_ID=$PROD_KEY_ID
AWS_SECRET_ACCESS_KEY=$PROD_SECRET

These credentials have been automatically added to your GitHub environments.
They are also saved temporarily in:
- Staging: $STAGING_CREDS
- Production: $PROD_CREDS

⚠️ Important: These files will be automatically deleted when you exit this script.
Make sure to save the credentials somewhere secure if you need them!
"
