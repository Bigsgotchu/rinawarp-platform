# Provider configuration moved to providers.tf

# RDS Instance
resource "aws_db_instance" "postgres" {
  identifier        = "${var.project_name}-db"
  engine           = "postgres"
  engine_version   = "14"
  instance_class   = var.db_instance_class
  allocated_storage = 20

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  backup_retention_period = 7
  multi_az               = true
  skip_final_snapshot    = false

  tags = {
    Name = "${var.project_name}-db"
    Environment = var.environment
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-redis-rg"
  description          = "Redis cluster for ${var.project_name}"
  engine              = "redis"
  engine_version      = "7.1"
  node_type           = var.redis_node_type
  port                = 6379
  num_cache_clusters  = 2  # Primary + 1 replica

  security_group_ids  = [aws_security_group.redis.id]
  subnet_group_name   = aws_elasticache_subnet_group.main.name

  snapshot_retention_limit = 7
  snapshot_window         = "05:00-09:00"
  maintenance_window      = "mon:10:00-mon:11:00"

  parameter_group_name = "default.redis7"

  automatic_failover_enabled = true
  auto_minor_version_upgrade = true
  multi_az_enabled           = true
  apply_immediately          = true

  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  auth_token                = random_password.redis_auth_token.result

  tags = {
    Name = "${var.project_name}-redis"
    Environment = var.environment
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster"
    Environment = var.environment
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = aws_subnet.public[*].id

  drop_invalid_header_fields = true
  enable_deletion_protection = true
  enable_http2              = true

  tags = {
    Name = "${var.project_name}-alb"
    Environment = var.environment
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# HTTP to HTTPS Redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "main" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-logs"
    Environment = var.environment
  }
}

# S3 Bucket for Application Storage
resource "aws_s3_bucket" "app_storage" {
  bucket = "${var.project_name}-storage-${var.environment}"

  tags = {
    Name = "${var.project_name}-storage"
    Environment = var.environment
  }
}

# Block Public Access for S3 bucket
resource "aws_s3_bucket_public_access_block" "app_storage" {
  bucket                  = aws_s3_bucket.app_storage.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable S3 Bucket Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Enable S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Route53 Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name = var.domain_name
    Environment = var.environment
  }
}

# SSL Certificate
resource "aws_acm_certificate" "main" {
  domain_name       = "rinawarptech.com"
  validation_method = "DNS"

  subject_alternative_names = ["*.rinawarptech.com"]

  tags = {
    Name        = "rinawarp-cert"
    Environment = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Certificate validation has been moved to a separate step

# DNS Records for Application
resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# DNS Records for API
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
