# SNS topic for alarm notifications
resource "aws_sns_topic" "alerts" {
  name = "rinawarp-alerts"
  tags = {
    Environment = "prod"
    Name        = "rinawarp-alerts"
  }
}

# CPU utilization alarm
resource "aws_cloudwatch_metric_alarm" "cpu_utilization" {
  alarm_name          = "rinawarp-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors ECS CPU utilization"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.app.name
  }

  tags = {
    Environment = "prod"
    Name        = "rinawarp-cpu-alarm"
  }
}

# Memory utilization alarm
resource "aws_cloudwatch_metric_alarm" "memory_utilization" {
  alarm_name          = "rinawarp-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_description  = "This metric monitors ECS memory utilization"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.app.name
  }

  tags = {
    Environment = "prod"
    Name        = "rinawarp-memory-alarm"
  }
}

# Target response time alarm
resource "aws_cloudwatch_metric_alarm" "target_response_time" {
  alarm_name          = "rinawarp-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period             = "300"
  statistic          = "Average"
  threshold          = "5"  # 5 seconds
  alarm_description  = "This metric monitors ALB target response time"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Environment = "prod"
    Name        = "rinawarp-response-time-alarm"
  }
}

# HTTP 5XX error rate alarm
resource "aws_cloudwatch_metric_alarm" "http_5xx" {
  alarm_name          = "rinawarp-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period             = "300"
  statistic          = "Sum"
  threshold          = "10"  # 10 errors in 5 minutes
  alarm_description  = "This metric monitors HTTP 5XX errors"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Environment = "prod"
    Name        = "rinawarp-5xx-alarm"
  }
}

# Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "rinawarp"

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
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.app.name],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = "us-west-2"
          title  = "ECS CPU and Memory Utilization"
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
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = "us-west-2"
          title  = "ALB Response Time and 5XX Errors"
        }
      }
    ]
  })
}
