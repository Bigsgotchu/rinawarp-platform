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
