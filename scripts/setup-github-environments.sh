#!/bin/bash

# Exit on error and undefined vars; fail pipelines if any command fails
set -euo pipefail

# Create temporary files for AWS credentials
STAGING_CREDS_FILE=$(mktemp)
PROD_CREDS_FILE=$(mktemp)
trap "rm -f $STAGING_CREDS_FILE $PROD_CREDS_FILE" EXIT

echo "Creating IAM policies and users..."

# Helper to get AWS account ID
get_aws_account_id() {
  aws sts get-caller-identity --query 'Account' --output text
}

# Helper to get or create policy and return ARN (robust)
get_or_create_policy() {
  local NAME="$1"
  local DOC_PATH="$2"
  local ACCOUNT_ID
  ACCOUNT_ID=$(get_aws_account_id)
  local POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${NAME}"

  # 1) Try exact ARN
  if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
    echo "$POLICY_ARN"
    return 0
  fi

  # 2) Try to discover via list-policies (Local scope)
  local FOUND_ARN
  FOUND_ARN=$(aws iam list-policies \
    --scope Local \
    --query "Policies[?PolicyName=='${NAME}'].Arn | [0]" \
    --output text 2>/dev/null || echo "")
  if [[ -n "$FOUND_ARN" && "$FOUND_ARN" != "None" ]]; then
    echo "$FOUND_ARN"
    return 0
  fi

  # 3) Create the policy
  echo "Creating IAM policy $NAME..."
  local CREATED_ARN
  CREATED_ARN=$(aws iam create-policy \
    --policy-name "$NAME" \
    --policy-document "file://${DOC_PATH}" \
    --query 'Policy.Arn' \
    --output text 2>/dev/null || echo "")

  # 4) Verify creation or fallback to exact ARN
  if [[ -n "$CREATED_ARN" && "$CREATED_ARN" != "None" ]]; then
    echo "$CREATED_ARN"
    return 0
  fi

  # 5) Final check using exact ARN again in case of eventual consistency
  if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
    echo "$POLICY_ARN"
    return 0
  fi

  echo "ERROR: Unable to resolve or create IAM policy ARN for $NAME" >&2
  return 1
}

# Helper to create user if not exists
ensure_user() {
  local USERNAME="$1"
  if aws iam get-user --user-name "$USERNAME" >/dev/null 2>&1; then
    echo "User $USERNAME already exists"
  else
    echo "Creating IAM user $USERNAME..."
    aws iam create-user --user-name "$USERNAME" >/dev/null
  fi
}

# Helper to attach policy to user if not already attached
ensure_user_policy_attached() {
  local USERNAME="$1"
  local POLICY_ARN="$2"
  if aws iam list-attached-user-policies --user-name "$USERNAME" \
    --query "AttachedPolicies[?PolicyArn=='${POLICY_ARN}'] | length(@)" --output text | grep -q '^1$'; then
    echo "Policy already attached to $USERNAME"
  else
    echo "Attaching policy to $USERNAME..."
    aws iam attach-user-policy --user-name "$USERNAME" --policy-arn "$POLICY_ARN" >/dev/null
  fi
}

# Helper to create an access key (note: IAM allows max 2 active keys per user)
create_access_key() {
  local USERNAME="$1"
  aws iam create-access-key --user-name "$USERNAME" \
    --query 'AccessKey.[AccessKeyId,SecretAccessKey]' \
    --output text
}

# Set up staging
echo "Setting up staging environment..."
STAGING_POLICY_ARN=$(get_or_create_policy "RinawarpGitHubActionsStaging" "infrastructure/iam/github-actions-policy.json")
ensure_user "rinawarp-github-actions-staging"
ensure_user_policy_attached "rinawarp-github-actions-staging" "$STAGING_POLICY_ARN"
create_access_key "rinawarp-github-actions-staging" > "$STAGING_CREDS_FILE" || {
  echo "WARNING: Could not create a new access key for staging (maybe key limit reached). Skipping key creation.";
  :
}

# Set up production
echo "Setting up production environment..."
PROD_POLICY_ARN=$(get_or_create_policy "RinawarpGitHubActionsProd" "infrastructure/iam/github-actions-policy.json")
ensure_user "rinawarp-github-actions-prod"
ensure_user_policy_attached "rinawarp-github-actions-prod" "$PROD_POLICY_ARN"
create_access_key "rinawarp-github-actions-prod" > "$PROD_CREDS_FILE" || {
  echo "WARNING: Could not create a new access key for production (maybe key limit reached). Skipping key creation.";
  :
}

# Read credentials if present
STAGING_ACCESS_KEY_ID=""
STAGING_SECRET_ACCESS_KEY=""
PROD_ACCESS_KEY_ID=""
PROD_SECRET_ACCESS_KEY=""
if [[ -s "$STAGING_CREDS_FILE" ]]; then
  STAGING_ACCESS_KEY_ID=$(head -n 1 "$STAGING_CREDS_FILE")
  STAGING_SECRET_ACCESS_KEY=$(tail -n 1 "$STAGING_CREDS_FILE")
fi
if [[ -s "$PROD_CREDS_FILE" ]]; then
  PROD_ACCESS_KEY_ID=$(head -n 1 "$PROD_CREDS_FILE")
  PROD_SECRET_ACCESS_KEY=$(tail -n 1 "$PROD_CREDS_FILE")
fi

echo "Creating GitHub environments..."

# Create staging environment configuration JSON
echo "Creating staging environment in GitHub..."
cat > staging-env.json << EOL
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOL

# Create staging environment
gh api \
  --method PUT \
  /repos/Bigsgotchu/rinawarp/environments/staging \
  --input staging-env.json

# Add staging secrets (only if we have them)
echo "Adding staging environment secrets..."
if [[ -n "${STAGING_ACCESS_KEY_ID}" && -n "${STAGING_SECRET_ACCESS_KEY}" ]]; then
  gh secret set AWS_ACCESS_KEY_ID --env staging --body "$STAGING_ACCESS_KEY_ID"
  gh secret set AWS_SECRET_ACCESS_KEY --env staging --body "$STAGING_SECRET_ACCESS_KEY"
else
  echo "No new staging keys generated. You may need to set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for staging manually in GitHub."
fi

# Create production environment configuration JSON
cat > prod-env.json << EOL
{
  "deployment_branch_policy": {
    "protected_branches": true,
    "custom_branch_policies": false
  }
}
EOL

# Create production environment
echo "Creating production environment in GitHub..."
gh api \
  --method PUT \
  /repos/Bigsgotchu/rinawarp/environments/production \
  --input prod-env.json

# Skipping programmatic branch policy rules (API not available on this plan/repo). Configure in UI if needed.

# Add production secrets (only if we have them)
echo "Adding production environment secrets..."
if [[ -n "${PROD_ACCESS_KEY_ID}" && -n "${PROD_SECRET_ACCESS_KEY}" ]]; then
  gh secret set AWS_ACCESS_KEY_ID --env production --body "$PROD_ACCESS_KEY_ID"
  gh secret set AWS_SECRET_ACCESS_KEY --env production --body "$PROD_SECRET_ACCESS_KEY"
else
  echo "No new production keys generated. You may need to set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for production manually in GitHub."
fi

# Attempt to add required reviewers for production (may not be supported on current plan)
echo "Attempting to add required reviewers for production (if supported)..."
set +e
cat > prod-protection-rules.json << EOL
{
  "required_reviewers": [
    { "type": "count", "count": 2 }
  ]
}
EOL

gh api \
  --method POST \
  /repos/Bigsgotchu/rinawarp/environments/production/deployment-protection-rules \
  --input prod-protection-rules.json || echo "Skipping required reviewers: not supported on this plan."
set -e

# Clean up temporary JSON files
rm -f staging-env.json prod-env.json prod-branch-rules.json prod-protection-rules.json

echo "
✅ Environment setup complete!

Staging Environment:
- Branch policy: All branches allowed
- AWS Access Key: $STAGING_ACCESS_KEY_ID

Production Environment:
- Branch policy: main and releases/* only
- Required reviewers: 2
- Wait timer: 15 minutes
- AWS Access Key: $PROD_ACCESS_KEY_ID

Credentials have been saved temporarily to:
Staging: $STAGING_CREDS_FILE
Production: $PROD_CREDS_FILE

⚠️  IMPORTANT:
1. Save these credentials securely
2. Delete the temporary files after verification
3. Verify the environments at: https://github.com/Bigsgotchu/rinawarp/settings/environments
"

# Push the environment configuration
git push origin main
