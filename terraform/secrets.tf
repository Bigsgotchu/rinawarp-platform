resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "rinawarp/app-secrets"
  description = "Application secrets for Rinawarp"
  tags = {
    Environment = "prod"
    Name        = "rinawarp-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    JWT_SECRET         = random_password.jwt_secret.result
    JWT_REFRESH_SECRET = random_password.jwt_refresh_secret.result
    REDIS_PASSWORD     = random_password.redis_password.result
    DATABASE_URL       = "postgresql://${aws_db_instance.postgres.username}:${aws_db_instance.postgres.password}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}"
  })
}

resource "random_password" "jwt_secret" {
  length  = 32
  special = true
}

resource "random_password" "jwt_refresh_secret" {
  length  = 32
  special = true
}

resource "random_password" "redis_password" {
  length  = 32
  special = true
}

# SSM Parameters for non-sensitive configuration
resource "aws_ssm_parameter" "app_config" {
  for_each = {
    "HOST"                    = "0.0.0.0"
    "PORT"                    = "3000"
    "NODE_ENV"               = "production"
    "REDIS_URL"              = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.port}"
    "REDIS_TLS"              = "true"
    "DB_SSL"                 = "true"
    "DB_MAX_CONNECTIONS"     = "20"
    "RATE_LIMIT_WINDOW"      = "900000"
    "RATE_LIMIT_MAX"         = "100"
    "LOG_LEVEL"              = "error"
    "ENABLE_REQUEST_LOGGING" = "true"
    "ENABLE_CSRF"            = "true"
    "TRUST_PROXY"            = "true"
    "BCRYPT_SALT_ROUNDS"     = "12"
  }

  name  = "/rinawarp/config/${each.key}"
  type  = "String"
  value = each.value
  tags = {
    Environment = "prod"
    Name        = "rinawarp-config"
  }
}
