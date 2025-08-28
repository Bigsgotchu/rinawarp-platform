#!/bin/bash

set -euo pipefail

# Store credentials in secure temporary files
STAGING_CREDS=$(mktemp)
PREVIEW_CREDS=$(mktemp)
PROD_CREDS=$(mktemp)

# Ensure we clean up temp files
trap "rm -f $STAGING_CREDS $PREVIEW_CREDS $PROD_CREDS" EXIT

setup_environment() {
    local ENV_NAME=$1
    local USER_NAME="rinawarp-github-actions-${ENV_NAME}"
    local CREDS_FILE=$2
    # Portable uppercase-first-letter without Bash 4+ ${var^}
    local FIRST_CHAR=${ENV_NAME:0:1}
    local REST_CHARS=${ENV_NAME:1}
    local UPPER_FIRST_CHAR=$(printf "%s" "$FIRST_CHAR" | tr '[:lower:]' '[:upper:]')
    local POLICY_NAME="RinawarpGitHubActions${UPPER_FIRST_CHAR}${REST_CHARS}"
    local ACCOUNT_ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
    local POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

    echo "Setting up $ENV_NAME environment..."
    
    # Create or update user
    if ! aws iam get-user --user-name "$USER_NAME" >/dev/null 2>&1; then
        aws iam create-user --user-name "$USER_NAME"
    fi

    # Create or update policy
    aws iam create-policy --policy-name "$POLICY_NAME" \
        --policy-document "file://infrastructure/iam/github-actions-policy.json" \
        --description "GitHub Actions policy for $ENV_NAME environment" \
        --no-cli-pager 2>/dev/null || true

    # Attach policy
    aws iam attach-user-policy \
        --user-name "$USER_NAME" \
        --policy-arn "$POLICY_ARN"

    # Create new access key
    aws iam create-access-key --user-name "$USER_NAME" \
        --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
        --output text > "$CREDS_FILE"

    # Create GitHub environment
    echo "Creating GitHub environment: $ENV_NAME"
    
    # Environment configuration
    cat > "${ENV_NAME}_env.json" << EOL
{
  "deployment_branch_policy": {
    "protected_branches": ${3:-false},
    "custom_branch_policies": ${4:-true}
  }
}
EOL

    # Create/update environment
    gh api \
        --method PUT \
        "/repos/Bigsgotchu/rinawarp/environments/${ENV_NAME}" \
        --input "${ENV_NAME}_env.json"

    # Set secrets
    local KEY_ID SECRET_KEY
    KEY_ID=$(head -n 1 "$CREDS_FILE")
    SECRET_KEY=$(tail -n 1 "$CREDS_FILE")
    
    echo "Setting $ENV_NAME environment secrets..."
    gh secret set AWS_ACCESS_KEY_ID --env "$ENV_NAME" --body "$KEY_ID"
    gh secret set AWS_SECRET_ACCESS_KEY --env "$ENV_NAME" --body "$SECRET_KEY"

    rm -f "${ENV_NAME}_env.json"
}

echo "Setting up all environments..."

# Setup Preview Environment (for PR deployments)
setup_environment "preview" "$PREVIEW_CREDS" false true

# Setup Staging Environment (for development)
setup_environment "staging" "$STAGING_CREDS" false true

# Setup Production Environment (protected)
setup_environment "production" "$PROD_CREDS" true false

# Create a test deployment to verify credentials
echo "Creating test deployment..."

cat > test-deployment.json << EOL
{
  "ref": "main",
  "task": "deploy",
  "environment": "staging",
  "description": "Test deployment",
  "required_contexts": [],
  "auto_merge": false
}
EOL

gh api \
    --method POST \
    /repos/Bigsgotchu/rinawarp/deployments \
    --input test-deployment.json

rm -f test-deployment.json

echo "
✅ All environments set up!

Environments created:
1. preview (for PR deployments)
2. staging (for development)
3. production (protected)

Each environment has:
- AWS IAM user with proper permissions
- AWS access keys
- GitHub environment secrets
- Deployment protection rules

Next steps:
1. Configure branch protection rules:
   - Go to: https://github.com/Bigsgotchu/rinawarp/settings/branches
   - Add rule for 'main':
     - Require pull request reviews
     - Dismiss stale pull request approvals
     - Require status checks
     - Include administrators

2. Configure environment protection:
   - Go to: https://github.com/Bigsgotchu/rinawarp/settings/environments
   - For production:
     - Add required reviewers
     - Set deployment branches (main, releases/*)
   - For staging:
     - Allow all branches
   - For preview:
     - Allow only PR branches

3. Test deployments:
   - A test deployment to staging has been created
   - Check status at: https://github.com/Bigsgotchu/rinawarp/deployments
"

# Save credentials (temporarily)
echo "
Credentials have been saved to:
- Preview: $PREVIEW_CREDS
- Staging: $STAGING_CREDS
- Production: $PROD_CREDS

⚠️ Important: These files will be deleted when you exit this script.
Save the credentials somewhere secure if needed!"
