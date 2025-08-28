resource "aws_s3_bucket" "downloads" {
  bucket = "downloads.rinawarptech.com"
}

resource "aws_s3_bucket_public_access_block" "downloads" {
  bucket = aws_s3_bucket.downloads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_distribution" "downloads" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  origin {
    domain_name = aws_s3_bucket.downloads.bucket_regional_domain_name
    origin_id   = "S3-downloads.rinawarptech.com"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.downloads.cloudfront_access_identity_path
    }
  }

  aliases = ["downloads.rinawarptech.com"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-downloads.rinawarptech.com"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.downloads.arn
    ssl_support_method  = "sni-only"
  }
}

resource "aws_cloudfront_origin_access_identity" "downloads" {
  comment = "downloads.rinawarptech.com"
}

resource "aws_s3_bucket_policy" "downloads" {
  bucket = aws_s3_bucket.downloads.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontReadAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.downloads.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.downloads.arn}/*"
      }
    ]
  })
}

resource "aws_acm_certificate" "downloads" {
  provider          = aws.us-east-1
  domain_name       = "downloads.rinawarptech.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Output the CloudFront domain name for setting up DNS
output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.downloads.domain_name
}
