aws_region = "us-west-2"
environment = "eks-prod"
domain_name = "rinawarptech.com"

rds_instance_type = "db.t3.small"
rds_storage_size = 50
backup_retention_days = 30

# ALB details not needed yet - will be configured after ALB is created
# alb_dns_name = ""
# alb_zone_id = ""

tags = {
  Environment = "Production"
  ManagedBy   = "Terraform"
  Project     = "Rinawarp"
}
