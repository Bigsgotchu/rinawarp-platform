resource "aws_synthetics_canary" "api_health" {
  name                 = "api-health-check"
  artifact_s3_location = "s3://${aws_s3_bucket.monitoring.id}/canary/api-health"
  execution_role_arn   = aws_iam_role.synthetics_role.arn
  runtime_version      = "syn-nodejs-puppeteer-6.0"
  handler             = "apiCheck.handler"

  schedule {
    expression = "rate(5 minutes)"
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.synthetics.id]
  }

  run_config {
    timeout_in_seconds = 60
    memory_in_mb      = 1024
    active_tracing    = true
  }

  code {
    script_text = <<-EOT
      const synthetics = require('Synthetics');
      const log = require('SyntheticsLogger');

      const apiCheck = async function () {
        const urls = [
          {
            url: 'https://api.rinawarptech.com/health',
            method: 'GET',
            expectedStatus: 200,
          },
          {
            url: 'https://api.rinawarptech.com/metrics',
            method: 'GET',
            expectedStatus: 200,
          },
        ];

        for (const endpoint of urls) {
          const { url, method, expectedStatus } = endpoint;
          
          const requestOptions = {
            headers: {
              'User-Agent': 'CloudWatch-Synthetics',
            },
            hostname: url,
            method: method,
            port: 443,
            protocol: 'https:',
          };

          const response = await synthetics.executeHttpStep(
            `Verify ${url}`,
            requestOptions,
            async function (res) {
              return res.statusCode === expectedStatus;
            }
          );

          if (response.statusCode !== expectedStatus) {
            throw new Error(`Failed to get ${url}: ${response.statusCode}`);
          }
        }
      };

      exports.handler = async () => {
        return await apiCheck();
      };
    EOT
  }

  tags = var.tags
}

resource "aws_synthetics_canary" "web_flows" {
  name                 = "web-user-flows"
  artifact_s3_location = "s3://${aws_s3_bucket.monitoring.id}/canary/web-flows"
  execution_role_arn   = aws_iam_role.synthetics_role.arn
  runtime_version      = "syn-nodejs-puppeteer-6.0"
  handler             = "webFlows.handler"

  schedule {
    expression = "rate(5 minutes)"
  }

  run_config {
    timeout_in_seconds = 180
    memory_in_mb      = 2048
    active_tracing    = true
  }

  code {
    script_text = <<-EOT
      const synthetics = require('Synthetics');
      const log = require('SyntheticsLogger');
      const puppeteer = require('puppeteer-core');

      const webFlows = async function () {
        // Set up browser
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        try {
          // Test homepage load
          await synthetics.executeStep('Load Homepage', async () => {
            const response = await page.goto('https://rinawarptech.com');
            await page.waitForSelector('.hero-section');
            return response.status() === 200;
          });

          // Test pricing page and plan selection
          await synthetics.executeStep('Check Pricing Page', async () => {
            await page.goto('https://rinawarptech.com/pricing');
            await page.waitForSelector('.pricing-cards');
            const plans = await page.$$('.pricing-card');
            return plans.length >= 3;
          });

          // Test download functionality
          await synthetics.executeStep('Verify Downloads', async () => {
            await page.goto('https://rinawarptech.com/download');
            await page.waitForSelector('.download-options');
            const downloadButtons = await page.$$('.download-button');
            return downloadButtons.length >= 3;
          });

        } finally {
          await browser.close();
        }
      };

      exports.handler = async () => {
        return await webFlows();
      };
    EOT
  }

  tags = var.tags
}

# Monitoring bucket
resource "aws_s3_bucket" "monitoring" {
  bucket = "rinawarp-monitoring-${var.environment}"
  
  lifecycle_rule {
    enabled = true
    
    expiration {
      days = 30
    }
  }

  tags = var.tags
}

# IAM role for synthetics
resource "aws_iam_role" "synthetics_role" {
  name = "synthetics-canary-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "synthetics.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Security group for synthetics
resource "aws_security_group" "synthetics" {
  name        = "synthetics-${var.environment}"
  description = "Security group for Synthetics canaries"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# CloudWatch dashboard for synthetics
resource "aws_cloudwatch_dashboard" "synthetics" {
  dashboard_name = "RinaWarp-Synthetics"

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
            ["CloudWatch Synthetics", "Duration", "CanaryName", aws_synthetics_canary.api_health.name],
            [".", "SuccessPercent", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Health Checks"
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
            ["CloudWatch Synthetics", "Duration", "CanaryName", aws_synthetics_canary.web_flows.name],
            [".", "SuccessPercent", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Web User Flows"
          period  = 300
        }
      }
    ]
  })
}
