# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Database subnet group for ${var.project_name}"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name        = "${var.project_name}-db-subnet-group"
    Environment = var.environment
  }
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project_name}-cache-subnet-group"
  description = "Cache subnet group for ${var.project_name}"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name        = "${var.project_name}-cache-subnet-group"
    Environment = var.environment
  }
}
