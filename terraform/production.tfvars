project_name = "rinawarp"
environment = "production"
aws_region = "us-west-2"

# Database Configuration
db_instance_class = "db.t3.medium"
db_name = "rinawarp_prod"
db_username = "rinawarp_admin"
db_password = "{{DB_PASSWORD}}"

# Redis Configuration
redis_node_type = "cache.t3.medium"

# Domain Configuration
domain_name = "rinawarptech.com"

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
public_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]

# ECS Configuration
container_memory = 2048
container_cpu = 1024
min_capacity = 3
max_capacity = 10

# Monitoring
enable_monitoring = true
retention_days = 30
