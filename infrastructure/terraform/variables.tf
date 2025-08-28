variable "aws_access_key" {
  description = "AWS access key"
  type        = string
}

variable "aws_secret_key" {
  description = "AWS secret key"
  type        = string
}

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "rinawarp.com"
}

variable "rds_instance_type" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.small"
}

variable "rds_storage_size" {
  description = "RDS storage size in GB"
  type        = number
  default     = 50
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Environment = "Production"
    ManagedBy   = "Terraform"
    Project     = "Rinawarp"
  }
}

# To be configured after ALB is created
#variable "alb_dns_name" {
#  description = "DNS name of the ALB created by AWS Load Balancer Controller"
#  type        = string
#}
#
#variable "alb_zone_id" {
#  description = "Zone ID of the ALB created by AWS Load Balancer Controller"
#  type        = string
#}
