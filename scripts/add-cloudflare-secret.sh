#!/bin/bash

# Read the token securely
read -sp "Enter Cloudflare API Token: " TOKEN
echo

# Store in AWS Secrets Manager
aws secretsmanager create-secret \
    --name rinawarp/cloudflare-api-token \
    --description "Cloudflare API Token for DNS management" \
    --secret-string "$TOKEN"

# Create Kubernetes secret
kubectl create secret generic cloudflare-credentials \
    --namespace rinawarp-staging \
    --from-literal=api-token="$TOKEN"

# Clean up
unset TOKEN
echo "Secrets stored successfully!"
