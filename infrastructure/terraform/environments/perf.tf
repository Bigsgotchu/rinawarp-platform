locals {
  perf_env = "perf"
  perf_domain = "perf.rinawarptech.com"
}

# VPC for performance testing
module "perf_vpc" {
  source = "../modules/vpc"

  name = "rinawarp-${local.perf_env}"
  cidr = "10.1.0.0/16"

  azs             = ["us-west-2a", "us-west-2b"]
  private_subnets = ["10.1.1.0/24", "10.1.2.0/24"]
  public_subnets  = ["10.1.101.0/24", "10.1.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true
  
  tags = merge(var.tags, {
    Environment = local.perf_env
    Purpose     = "Performance Testing"
  })
}

# EKS Cluster for performance testing
module "perf_eks" {
  source = "../modules/eks"

  cluster_name    = "rinawarp-${local.perf_env}"
  cluster_version = "1.27"
  
  vpc_id         = module.perf_vpc.vpc_id
  subnet_ids     = module.perf_vpc.private_subnets
  
  node_groups = {
    perf = {
      name           = "perf"
      instance_types = ["c5.xlarge"]  # Dedicated compute for consistent performance
      min_size       = 2
      max_size       = 4
      desired_size   = 2
      
      labels = {
        "node.kubernetes.io/purpose" = "performance"
      }
      
      taints = []
    }
  }

  tags = merge(var.tags, {
    Environment = local.perf_env
  })
}

# RDS for performance testing
module "perf_rds" {
  source = "../modules/rds"

  identifier = "rinawarp-${local.perf_env}"

  engine               = "postgres"
  engine_version       = "13.7"
  instance_class       = "db.r6g.large"  # Memory-optimized for consistent performance
  allocated_storage    = 100
  storage_encrypted    = true

  db_name  = "rinawarp"
  username = "rinawarp"
  port     = "5432"

  vpc_security_group_ids = [aws_security_group.perf_rds.id]
  subnet_ids             = module.perf_vpc.private_subnets

  backup_retention_period = 1
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  performance_insights_enabled = true
  
  tags = merge(var.tags, {
    Environment = local.perf_env
  })
}

# Redis for performance testing
module "perf_redis" {
  source = "../modules/redis"

  cluster_id           = "rinawarp-${local.perf_env}"
  node_type           = "cache.r6g.large"
  num_cache_nodes     = 2
  port                = 6379

  subnet_group_name    = aws_elasticache_subnet_group.perf_redis.name
  security_group_ids   = [aws_security_group.perf_redis.id]

  automatic_failover_enabled = true
  multi_az_enabled          = false

  tags = merge(var.tags, {
    Environment = local.perf_env
  })
}

# Load testing infrastructure
module "perf_load_test" {
  source = "../modules/load-test"

  name           = "rinawarp-${local.perf_env}"
  instance_type  = "c5.2xlarge"
  instance_count = 2
  subnet_ids     = module.perf_vpc.private_subnets
  vpc_id         = module.perf_vpc.vpc_id

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y docker git
              systemctl start docker
              systemctl enable docker
              curl -L https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar xz
              mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/
              EOF

  tags = merge(var.tags, {
    Environment = local.perf_env
    Purpose     = "Load Testing"
  })
}

# Monitoring infrastructure
module "perf_monitoring" {
  source = "../modules/monitoring"

  environment = local.perf_env
  vpc_id      = module.perf_vpc.vpc_id
  subnet_ids  = module.perf_vpc.private_subnets

  grafana_admin_password = var.grafana_admin_password
  prometheus_retention   = "7d"

  alert_email    = "alerts@rinawarptech.com"
  slack_webhook  = var.slack_webhook_url

  tags = merge(var.tags, {
    Environment = local.perf_env
  })
}

# Security Groups
resource "aws_security_group" "perf_rds" {
  name        = "rinawarp-${local.perf_env}-rds"
  description = "Security group for performance testing RDS"
  vpc_id      = module.perf_vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.perf_eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Environment = local.perf_env
  })
}

resource "aws_security_group" "perf_redis" {
  name        = "rinawarp-${local.perf_env}-redis"
  description = "Security group for performance testing Redis"
  vpc_id      = module.perf_vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.perf_eks.cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Environment = local.perf_env
  })
}

# Route53 records
resource "aws_route53_record" "perf" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.perf_domain
  type    = "A"

  alias {
    name                   = module.perf_eks.cluster_endpoint
    zone_id               = module.perf_eks.cluster_zone_id
    evaluate_target_health = true
  }
}

# Grafana Dashboards
resource "grafana_dashboard" "performance" {
  provider = grafana.perf
  folder   = "Performance Testing"

  config_json = file("${path.module}/dashboards/performance.json")
}
