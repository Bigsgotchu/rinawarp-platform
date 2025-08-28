# CloudWatch Dashboard for Downloads Infrastructure
resource "aws_cloudwatch_dashboard" "downloads" {
  dashboard_name = "downloads-rinawarptech"

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
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.downloads.id],
            [".", "4xxErrorRate", ".", "."],
            [".", "5xxErrorRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "CloudFront Metrics"
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
            ["AWS/S3", "NumberOfObjects", "BucketName", aws_s3_bucket.downloads.id],
            [".", "BucketSizeBytes", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "S3 Bucket Metrics"
          period  = 86400
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx_errors" {
  alarm_name          = "cloudfront-5xx-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period             = "300"
  statistic          = "Average"
  threshold          = "5"
  alarm_description  = "This metric monitors CloudFront 5xx error rate"
  alarm_actions      = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.downloads.id
  }
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_4xx_errors" {
  alarm_name          = "cloudfront-4xx-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period             = "300"
  statistic          = "Average"
  threshold          = "10"
  alarm_description  = "This metric monitors CloudFront 4xx error rate"
  alarm_actions      = [aws_sns_topic.monitoring_alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.downloads.id
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "monitoring_alerts" {
  name = "downloads-monitoring-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.monitoring_alerts.arn
  protocol  = "email"
  endpoint  = "alerts@rinawarptech.com"
}
