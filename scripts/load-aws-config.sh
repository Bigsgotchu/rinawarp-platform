#!/bin/sh

# Exit on any error
set -e

# Load SSM parameters
for param in $(aws ssm get-parameters-by-path --path "/rinawarp/config" --recursive --with-decryption --query "Parameters[*].[Name,Value]" --output text); do
  param_name=$(basename "$param" | cut -f1)
  param_value=$(basename "$param" | cut -f2)
  export "$param_name"="$param_value"
done

# Load Secrets Manager secrets
secrets=$(aws secretsmanager get-secret-value --secret-id "rinawarp/app-secrets" --query "SecretString" --output text)
for key in $(echo "$secrets" | jq -r 'keys[]'); do
  value=$(echo "$secrets" | jq -r ".$key")
  export "$key"="$value"
done

# Execute the main command
exec "$@"
