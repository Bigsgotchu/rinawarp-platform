#!/bin/bash

# Create secrets file
cat > terraform.tfvars << EOF
aws_region = "us-west-2"
environment = "perf"
domain_name = "rinawarptech.com"

# Access Keys (from GitHub Secrets)
aws_access_key = "{{AWS_ACCESS_KEY_ID}}"
aws_secret_key = "{{AWS_SECRET_ACCESS_KEY}}"

# Instance Types
rds_instance_type = "db.t3.small"
rds_storage_size = 50
backup_retention_days = 30

# Tags
tags = {
  Environment = "Performance"
  ManagedBy   = "Terraform"
  Project     = "Rinawarp"
}

# Other configurations
grafana_admin_password = "admin"  # Will be changed after initial setup
EOF

echo "Created terraform.tfvars with GitHub secrets"

# Initialize and plan
terraform init
terraform plan \
  -target=module.perf_vpc \
  -target=module.perf_eks \
  -target=module.perf_monitoring \
  -target=module.perf_rds \
  -target=module.perf_redis \
  -out=perf.tfplan
