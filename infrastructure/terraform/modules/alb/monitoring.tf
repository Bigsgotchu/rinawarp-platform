# CloudWatch Log Group for ALB Controller
resource "aws_cloudwatch_log_group" "alb_controller" {
  name              = "/aws/eks/${var.cluster_name}/alb-controller"
  retention_in_days = 30

  tags = var.tags
}

# CloudWatch Dashboard for ALB metrics
resource "aws_cloudwatch_dashboard" "alb" {
  dashboard_name = "ALB-Metrics-${var.environment}"

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
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "*"],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ALB Request Metrics"
          period  = 300
          stat    = "Sum"
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
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "*", { "stat": "p95" }],
            ["...", { "stat": "p50" }],
            ["...", { "stat": "Average" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ALB Response Times"
          period  = 300
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
            ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", "*"],
            [".", "UnHealthyHostCount", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Target Health"
          period  = 60
          stat    = "Average"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "ProcessedBytes", "LoadBalancer", "*"],
            [".", "ConsumedLCUs", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ALB Throughput"
          period  = 300
          stat    = "Sum"
        }
      }
    ]
  })
}

# CloudWatch Metric Alarm for error rate
resource "aws_cloudwatch_metric_alarm" "alb_error_rate" {
  alarm_name          = "ALB-HighErrorRate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "HTTPCode_Target_5XX_Count"
  namespace          = "AWS/ApplicationELB"
  period             = 300
  statistic          = "Sum"
  threshold          = 10
  alarm_description  = "ALB 5XX error rate is too high"
  alarm_actions      = [] # Add SNS topic ARN here if needed

  dimensions = {
    LoadBalancer = "*"
  }

  tags = var.tags
}

# CloudWatch Metric Alarm for latency
resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  alarm_name          = "ALB-HighLatency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "TargetResponseTime"
  namespace          = "AWS/ApplicationELB"
  period             = 300
  statistic          = "p95"
  threshold          = 2
  alarm_description  = "ALB P95 latency is too high"
  alarm_actions      = [] # Add SNS topic ARN here if needed

  dimensions = {
    LoadBalancer = "*"
  }

  tags = var.tags
}
