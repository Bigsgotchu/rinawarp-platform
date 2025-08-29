variable "name" {
  description = "Name prefix for resources"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for load testing"
  type        = string
  default     = "c5.2xlarge"
}

variable "instance_count" {
  description = "Number of load testing instances"
  type        = number
  default     = 2
}

variable "subnet_ids" {
  description = "List of subnet IDs for load testing instances"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID for load testing instances"
  type        = string
}

variable "user_data" {
  description = "User data script for instance initialization"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Load Testing Security Group
resource "aws_security_group" "load_test" {
  name        = "${var.name}-load-test"
  description = "Security group for load testing instances"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.name}-load-test"
  })
}

# IAM Role for Load Testing
resource "aws_iam_role" "load_test" {
  name = "${var.name}-load-test"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "load_test" {
  name = "${var.name}-load-test"
  role = aws_iam_role.load_test.name
}

# IAM Role Policy for CloudWatch Metrics
resource "aws_iam_role_policy" "cloudwatch_metrics" {
  name = "${var.name}-cloudwatch-metrics"
  role = aws_iam_role.load_test.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      }
    ]
  })
}

# Get latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# Launch Template for Load Testing
resource "aws_launch_template" "load_test" {
  name_prefix   = "${var.name}-load-test"
  image_id      = data.aws_ami.amazon_linux_2.id
  instance_type = var.instance_type

  network_interfaces {
    associate_public_ip_address = true
    security_groups            = [aws_security_group.load_test.id]
  }

  iam_instance_profile {
    name = aws_iam_instance_profile.load_test.name
  }

  user_data = base64encode(var.user_data)

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(var.tags, {
      Name = "${var.name}-load-test"
    })
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Group for Load Testing
resource "aws_autoscaling_group" "load_test" {
  name                = "${var.name}-load-test"
  desired_capacity    = var.instance_count
  max_size            = var.instance_count * 2
  min_size            = 1
  target_group_arns   = []
  vpc_zone_identifier = var.subnet_ids

  launch_template {
    id      = aws_launch_template.load_test.id
    version = aws_launch_template.load_test.latest_version
  }

  tag {
    key                 = "Name"
    value               = "${var.name}-load-test"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = var.tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch Log Group for Load Test Results
resource "aws_cloudwatch_log_group" "load_test" {
  name              = "/load-test/${var.name}"
  retention_in_days = 30

  tags = var.tags
}

output "asg_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.load_test.name
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.load_test.id
}

output "iam_role_arn" {
  description = "ARN of the IAM role"
  value       = aws_iam_role.load_test.arn
}

output "log_group_name" {
  description = "Name of the CloudWatch Log Group"
  value       = aws_cloudwatch_log_group.load_test.name
}
