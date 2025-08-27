project_name = "rinawarp"
environment  = "prod"
aws_region   = "us-west-2"

# Network configuration
vpc_cidr            = "10.0.0.0/16"
availability_zones  = ["us-west-2a", "us-west-2b", "us-west-2c"]
enable_nat_gateway  = true

# Database configuration
db_instance_class = "db.t3.medium"
db_name          = "rinawarp_prod"
db_username      = "rinawarp_admin"
# db_password to be provided via environment variable TF_VAR_db_password

# Redis configuration
redis_node_type = "cache.t3.micro"

# Application configuration
app_port        = 3000
desired_count   = 2
domain_name     = "api.rinawarptech.com"
# ssl_certificate_arn to be provided via environment variable TF_VAR_ssl_certificate_arn

# Monitoring
container_insights = true
