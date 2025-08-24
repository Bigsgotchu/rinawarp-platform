variable "name" {
  description = "Name of the ECR repository"
  type        = string
}

variable "allowed_principals" {
  description = "List of AWS IAM ARNs that are allowed to access the ECR repository"
  type        = list(string)
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
