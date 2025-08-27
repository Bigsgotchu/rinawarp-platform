variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "rinawarp"
}

variable "environment" {
  description = "Environment (e.g., prod, staging)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "rinawarp_prod"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "rinawarp_admin"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "rinawarptech.com"
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "container_insights" {
  description = "Enable Container Insights for ECS"
  type        = bool
  default     = true
}

variable "app_port" {
  description = "Port exposed by the application"
  type        = number
  default     = 3000
}

variable "container_cpu" {
  description = "CPU units for the container"
  type        = number
  default     = 1024
}

variable "container_memory" {
  description = "Memory limit for the container"
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "Desired count of application containers"
  type        = number
  default     = 3
}

variable "health_check_path" {
  description = "Path for ALB health check"
  type        = string
  default     = "/health"
}
