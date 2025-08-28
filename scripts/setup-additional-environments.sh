#!/bin/bash

set -euo pipefail

# Store credentials in secure temporary files
DEV_CREDS=$(mktemp)
QA_CREDS=$(mktemp)
E2E_CREDS=$(mktemp)
CI_CREDS=$(mktemp)

# Ensure we clean up temp files
trap "rm -f $DEV_CREDS $QA_CREDS $E2E_CREDS $CI_CREDS" EXIT

setup_environment() {
    local ENV_NAME=$1
    local USER_NAME="rinawarp-github-actions-${ENV_NAME}"
    local CREDS_FILE=$2
    # Portable uppercase-first-letter
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

    # Add specific environment variables
    case "$ENV_NAME" in
        "dev")
            gh secret set DEBUG --env "$ENV_NAME" --body "true"
            gh secret set LOG_LEVEL --env "$ENV_NAME" --body "debug"
            ;;
        "qa")
            gh secret set TEST_MODE --env "$ENV_NAME" --body "true"
            gh secret set MOCKED_SERVICES --env "$ENV_NAME" --body "false"
            ;;
        "e2e")
            gh secret set CYPRESS_BASE_URL --env "$ENV_NAME" --body "https://e2e.rinawarptech.com"
            gh secret set TEST_USER_EMAIL --env "$ENV_NAME" --body "e2e-test@rinawarptech.com"
            ;;
        "ci")
            gh secret set CI_MODE --env "$ENV_NAME" --body "true"
            gh secret set SKIP_TESTS --env "$ENV_NAME" --body "false"
            ;;
    esac

    rm -f "${ENV_NAME}_env.json"
}

echo "Setting up additional environments..."

# Setup Dev Environment (for local development testing)
setup_environment "dev" "$DEV_CREDS" false true

# Setup QA Environment (for testing)
setup_environment "qa" "$QA_CREDS" false true

# Setup E2E Environment (for end-to-end testing)
setup_environment "e2e" "$E2E_CREDS" false true

# Setup CI Environment (for continuous integration)
setup_environment "ci" "$CI_CREDS" false true

echo "
✅ Additional environments set up!

Environments created:
1. dev (for local development testing)
2. qa (for QA/testing)
3. e2e (for end-to-end testing)
4. ci (for continuous integration)

Each environment has:
- AWS IAM user with proper permissions
- AWS access keys
- GitHub environment secrets
- Environment-specific variables

Credentials have been saved to:
- Dev: $DEV_CREDS
- QA: $QA_CREDS
- E2E: $E2E_CREDS
- CI: $CI_CREDS

⚠️ Important: These files will be deleted when you exit this script.
Save the credentials somewhere secure if needed!

Next steps:
1. Configure branch protections:
   - dev: Allow feature/* branches
   - qa: Allow release/* branches
   - e2e: Allow main and release/* branches
   - ci: Allow all branches

2. Update CI/CD pipelines:
   - Add environment-specific steps
   - Configure test matrix
   - Set up deployment conditions

3. Configure DNS and infrastructure:
   - Set up subdomain for each environment
   - Configure load balancers
   - Set up monitoring
"
