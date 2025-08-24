resource "aws_elasticache_replication_group" "main" {
  replication_group_id          = var.cluster_id
  replication_group_description = "Redis cluster for ${var.cluster_id}"
  node_type                     = var.node_type
  port                         = var.port
  parameter_group_family       = "redis6.x"
  automatic_failover_enabled   = var.automatic_failover_enabled
  multi_az_enabled            = var.multi_az_enabled
  number_cache_clusters       = var.num_cache_nodes
  subnet_group_name           = var.subnet_group_name
  security_group_ids          = var.security_group_ids
  engine                      = "redis"
  engine_version             = "6.x"
  maintenance_window         = "sun:05:00-sun:06:00"
  snapshot_window            = "04:00-05:00"
  snapshot_retention_limit   = 7
  
  tags = var.tags
}

# Variables
variable "cluster_id" {
  description = "ID for the Redis cluster"
  type        = string
}

variable "node_type" {
  description = "Node type for Redis cluster"
  type        = string
}

variable "num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
}

variable "port" {
  description = "Port number"
  type        = number
  default     = 6379
}

variable "subnet_group_name" {
  description = "Name of the subnet group"
  type        = string
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable multi-AZ"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Outputs
output "primary_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint" {
  value = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "port" {
  value = aws_elasticache_replication_group.main.port
}

output "cluster_id" {
  value = aws_elasticache_replication_group.main.id
}
