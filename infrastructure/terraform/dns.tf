# Route53 zone for rinawarptech.com
resource "aws_route53_zone" "main" {
  name = "rinawarptech.com"
}

# DNS record for downloads subdomain
resource "aws_route53_record" "downloads" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "downloads.rinawarptech.com"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.downloads.domain_name
    zone_id               = aws_cloudfront_distribution.downloads.hosted_zone_id
    evaluate_target_health = false
  }
}

# ACM Certificate DNS validation records
resource "aws_route53_record" "downloads_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.downloads.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# Wait for certificate validation
resource "aws_acm_certificate_validation" "downloads" {
  provider                = aws.us-east-1
  certificate_arn         = aws_acm_certificate.downloads.arn
  validation_record_fqdns = [for record in aws_route53_record.downloads_cert_validation : record.fqdn]
}
