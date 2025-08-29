#!/bin/bash

# Export AWS credentials from environment
export AWS_ACCESS_KEY_ID="{{AWS_ACCESS_KEY_ID}}"
export AWS_SECRET_ACCESS_KEY="{{AWS_SECRET_ACCESS_KEY}}"

# Set Terraform variables
export TF_VAR_aws_access_key="$AWS_ACCESS_KEY_ID"
export TF_VAR_aws_secret_key="$AWS_SECRET_ACCESS_KEY"

# Additional variables for performance environment
export TF_VAR_environment="perf"
export TF_VAR_grafana_admin_password="admin"  # This will be changed after initial setup
export TF_VAR_slack_webhook_url="$(gh secret list | grep SLACK_WEBHOOK_URL | cut -f1)"

# Run Terraform plan
terraform plan \
  -target=module.perf_vpc \
  -target=module.perf_eks \
  -target=module.perf_monitoring \
  -target=module.perf_rds \
  -target=module.perf_redis \
  -out=perf.tfplan
