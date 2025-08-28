resource "aws_cloudwatch_dashboard" "rinawarp_platform" {
  dashboard_name = "RinaWarp-Platform"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.downloads.id, {"label": "Production Downloads"}],
            [".", "4xxErrorRate", ".", "."],
            [".", "5xxErrorRate", ".", "."],
            ["AWS/CloudFront", "Requests", "DistributionId", data.aws_cloudfront_distribution.staging.id, {"label": "Staging Downloads"}],
            [".", "4xxErrorRate", ".", "."],
            [".", "5xxErrorRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "Download Distribution Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["RinaWarp/API", "Requests", "Environment", "production", {"label": "Production API"}],
            [".", "Latency", ".", ".", {"yAxis": "right"}],
            [".", "Requests", "Environment", "staging", {"label": "Staging API"}],
            [".", "Latency", ".", ".", {"yAxis": "right"}]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Performance"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "rinawarp-${var.environment}", {"label": "Production DB"}],
            [".", "FreeStorageSpace", ".", ".", {"yAxis": "right"}],
            [".", "CPUUtilization", "DBInstanceIdentifier", "rinawarp-staging", {"label": "Staging DB"}],
            [".", "FreeStorageSpace", ".", ".", {"yAxis": "right"}]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Database Performance"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          query = "SOURCE '/aws/eks/rinawarp-${var.environment}' | fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 20"
          region  = var.aws_region
          title   = "Recent Error Logs"
          view    = "table"
        }
      }
    ]
  })
}

# Alarms for Production
resource "aws_cloudwatch_metric_alarm" "api_error_rate" {
  alarm_name          = "api-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "RinaWarp/API"
  period             = "300"
  statistic          = "Average"
  threshold          = "1"
  alarm_description  = "API error rate is too high"
  alarm_actions      = [aws_sns_topic.platform_alerts.arn]

  dimensions = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "api-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "Latency"
  namespace           = "RinaWarp/API"
  period             = "300"
  statistic          = "Average"
  threshold          = "1000"  # 1 second
  alarm_description  = "API latency is too high"
  alarm_actions      = [aws_sns_topic.platform_alerts.arn]

  dimensions = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "Database CPU utilization is too high"
  alarm_actions      = [aws_sns_topic.platform_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = "rinawarp-${var.environment}"
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "platform_alerts" {
  name = "rinawarp-platform-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.platform_alerts.arn
  protocol  = "email"
  endpoint  = "alerts@rinawarptech.com"
}

resource "aws_sns_topic_subscription" "alerts_slack" {
  topic_arn = aws_sns_topic.platform_alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# Custom Metrics Configuration
resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = "api-errors"
  pattern        = "[timestamp, requestid, level = ERROR, ...]"
  log_group_name = "/aws/eks/rinawarp-${var.environment}"

  metric_transformation {
    name          = "ApiErrors"
    namespace     = "RinaWarp/API"
    value         = "1"
    default_value = "0"
  }
}
