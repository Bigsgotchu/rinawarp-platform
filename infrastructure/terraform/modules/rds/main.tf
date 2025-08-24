resource "aws_db_instance" "main" {
  identifier = var.identifier

  engine            = var.engine
  engine_version    = var.engine_version
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_encrypted = var.storage_encrypted

  db_name  = var.db_name
  username = var.username
  password = random_password.main.result
  port     = var.port

  vpc_security_group_ids = var.vpc_security_group_ids
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window

  multi_az = var.multi_az

  skip_final_snapshot = true

  tags = var.tags
}

resource "aws_db_subnet_group" "main" {
  name       = var.identifier
  subnet_ids = var.subnet_ids

  tags = var.tags
}

resource "random_password" "main" {
  length  = 32
  special = false
}

# Variables
variable "identifier" {
  description = "Identifier for the RDS instance"
  type        = string
}

variable "engine" {
  description = "Database engine"
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  description = "Database engine version"
  type        = string
}

variable "instance_class" {
  description = "Instance class"
  type        = string
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
}

variable "storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Name of the database"
  type        = string
}

variable "username" {
  description = "Master username"
  type        = string
}

variable "port" {
  description = "Database port"
  type        = string
  default     = "5432"
}

variable "vpc_security_group_ids" {
  description = "List of VPC security group IDs"
  type        = list(string)
}

variable "subnet_ids" {
  description = "List of subnet IDs"
  type        = list(string)
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Outputs
output "endpoint" {
  value = aws_db_instance.main.endpoint
}

output "username" {
  value = aws_db_instance.main.username
}

output "password" {
  value     = random_password.main.result
  sensitive = true
}

output "database_name" {
  value = aws_db_instance.main.db_name
}

output "port" {
  value = aws_db_instance.main.port
}
