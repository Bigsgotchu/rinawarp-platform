terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "rinawarp-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "rinawarp-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"

  cluster_name    = "rinawarp-${var.environment}"
  cluster_version = "1.27"
  
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnets
  
  node_groups = {
    general = {
      name           = "general"
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 5
      desired_size   = 2
      
      labels = {
        "node.kubernetes.io/purpose" = "general"
      }
      
      taints = []
    }
  }
}

# VPC
module "vpc" {
  source = "./modules/vpc"

  name = "rinawarp-${var.environment}"
  cidr = "10.0.0.0/16"

  azs             = ["us-west-2a", "us-west-2b", "us-west-2c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true
}

# RDS Database
module "rds" {
  source = "./modules/rds"

  identifier = "rinawarp-${var.environment}"

  engine               = "postgres"
  engine_version       = "13.7"
  instance_class       = var.rds_instance_type
  allocated_storage    = var.rds_storage_size
  storage_encrypted    = true

  db_name  = "rinawarp"
  username = "rinawarp"
  port     = "5432"

  vpc_security_group_ids = [aws_security_group.rds.id]
  subnet_ids             = module.vpc.private_subnets

  backup_retention_period = var.backup_retention_days
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  multi_az = true
}

# Redis Cluster
module "redis" {
  source = "./modules/redis"

  cluster_id           = "rinawarp-${var.environment}"
  node_type           = "cache.t3.micro"
  num_cache_nodes     = 2
  port                = 6379

  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  automatic_failover_enabled = true
  multi_az_enabled          = true
}

# Elasticache Subnet Group
resource "aws_elasticache_subnet_group" "redis" {
  name       = "rinawarp-${var.environment}-redis"
  subnet_ids = module.vpc.private_subnets
}

# Get current AWS account info
data "aws_caller_identity" "current" {}

# Security Groups
resource "aws_security_group" "rds" {
  name        = "rinawarp-${var.environment}-rds"
  description = "Security group for RDS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
}

resource "aws_security_group" "redis" {
  name        = "rinawarp-${var.environment}-redis"
  description = "Security group for Redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
}

# Route53 and DNS
resource "aws_route53_zone" "main" {
  name = var.domain_name
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
name                   = module.eks.endpoint
    zone_id                = module.eks.cluster_zone_id
    evaluate_target_health = true
  }
}

# Certificate Manager
resource "aws_acm_certificate" "main" {
  domain_name       = "*.${var.domain_name}"
  validation_method = "DNS"

  subject_alternative_names = [var.domain_name]

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch Monitoring
resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/eks/rinawarp-${var.environment}"
  retention_in_days = 30
}

# Container Registry
module "ecr" {
  source = "./modules/ecr"

  name = "rinawarp"
  allowed_principals = [
    module.eks.cluster_role_arn,
    data.aws_caller_identity.current.arn,
  ]

  tags = var.tags
}

# Secrets Manager
resource "aws_secretsmanager_secret" "app" {
  name = "rinawarp-${var.environment}"
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    POSTGRES_PASSWORD = random_password.db.result
    REDIS_PASSWORD   = random_password.redis.result
    JWT_SECRET       = random_password.jwt.result
    COOKIE_SECRET    = random_password.cookie.result
  })
}

# Random Passwords
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "random_password" "redis" {
  length  = 32
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = true
}

resource "random_password" "cookie" {
  length  = 32
  special = true
}

# Outputs
output "kubeconfig_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --name rinawarp-${var.environment} --region ${var.aws_region}"
}

output "api_endpoint" {
  description = "API endpoint"
  value       = "https://api.${var.domain_name}"
}

output "db_endpoint" {
  description = "Database endpoint"
  value       = module.rds.endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.redis.endpoint
}
