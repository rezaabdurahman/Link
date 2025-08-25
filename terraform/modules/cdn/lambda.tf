# Lambda@Edge Functions for CDN Optimization
# This file contains Lambda@Edge functions for security headers, URL rewriting, and A/B testing

# Archive file for security headers function
data "archive_file" "security_headers" {
  count = var.enable_lambda_edge && var.security_headers_function ? 1 : 0
  
  type        = "zip"
  output_path = "${path.module}/lambda/security_headers.zip"
  
  source {
    content = templatefile("${path.module}/templates/security_headers.js.tpl", {
      domain_name = var.domain_name
      environment = var.environment
    })
    filename = "index.js"
  }
  
  depends_on = [local_file.security_headers_js]
}

# Archive file for URL rewrite function
data "archive_file" "url_rewrite" {
  count = var.enable_lambda_edge && var.url_rewrite_function ? 1 : 0
  
  type        = "zip"
  output_path = "${path.module}/lambda/url_rewrite.zip"
  
  source {
    content = file("${path.module}/templates/url_rewrite.js.tpl")
    filename = "index.js"
  }
  
  depends_on = [local_file.url_rewrite_js]
}

# Security headers Lambda@Edge function (must be in us-east-1)
resource "aws_lambda_function" "security_headers" {
  count    = var.enable_lambda_edge && var.security_headers_function ? 1 : 0
  provider = aws.us_east_1

  filename         = data.archive_file.security_headers[0].output_path
  function_name    = "${var.project_name}-security-headers-${var.environment}"
  role            = aws_iam_role.lambda_edge[0].arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.security_headers[0].output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 5
  publish         = true

  description = "Adds security headers to CloudFront responses for ${var.environment}"

  tags = merge(local.common_tags, {
    Name = "security-headers-lambda"
  })

  depends_on = [
    aws_iam_role_policy_attachment.lambda_edge[0],
    aws_cloudwatch_log_group.lambda_security_headers[0]
  ]
}

# URL rewrite Lambda@Edge function (must be in us-east-1)
resource "aws_lambda_function" "url_rewrite" {
  count    = var.enable_lambda_edge && var.url_rewrite_function ? 1 : 0
  provider = aws.us_east_1

  filename         = data.archive_file.url_rewrite[0].output_path
  function_name    = "${var.project_name}-url-rewrite-${var.environment}"
  role            = aws_iam_role.lambda_edge[0].arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.url_rewrite[0].output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 5
  publish         = true

  description = "Handles URL rewriting and SPA routing for ${var.environment}"

  tags = merge(local.common_tags, {
    Name = "url-rewrite-lambda"
  })

  depends_on = [
    aws_iam_role_policy_attachment.lambda_edge[0],
    aws_cloudwatch_log_group.lambda_url_rewrite[0]
  ]
}

# CloudWatch Log Groups for Lambda@Edge functions (us-east-1)
resource "aws_cloudwatch_log_group" "lambda_security_headers" {
  count    = var.enable_lambda_edge && var.security_headers_function ? 1 : 0
  provider = aws.us_east_1
  
  name              = "/aws/lambda/${var.project_name}-security-headers-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7
  
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "lambda_url_rewrite" {
  count    = var.enable_lambda_edge && var.url_rewrite_function ? 1 : 0
  provider = aws.us_east_1
  
  name              = "/aws/lambda/${var.project_name}-url-rewrite-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7
  
  tags = local.common_tags
}

# Create lambda directory and function files
resource "local_file" "security_headers_js" {
  count = var.enable_lambda_edge && var.security_headers_function ? 1 : 0
  
  filename = "${path.module}/lambda/security_headers.js"
  content = templatefile("${path.module}/templates/security_headers.js.tpl", {
    domain_name = var.domain_name
    environment = var.environment
  })
}

resource "local_file" "url_rewrite_js" {
  count = var.enable_lambda_edge && var.url_rewrite_function ? 1 : 0
  
  filename = "${path.module}/lambda/url_rewrite.js"
  content = file("${path.module}/templates/url_rewrite.js.tpl")
}