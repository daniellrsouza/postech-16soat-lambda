data "archive_file" "auth_cpf" {
  type        = "zip"
  source_dir  = "${var.dist_dir}/auth-cpf"
  output_path = "${path.module}/build/auth-cpf.zip"
  # Mesmo modo no Windows e no Linux do CI: o hash do pacote não muda à toa.
  output_file_mode = "0644"
}

data "archive_file" "authorizer" {
  type        = "zip"
  source_dir  = "${var.dist_dir}/authorizer"
  output_path = "${path.module}/build/authorizer.zip"
  # Mesmo modo no Windows e no Linux do CI: o hash do pacote não muda à toa.
  output_file_mode = "0644"
}

resource "aws_cloudwatch_log_group" "auth_cpf" {
  name              = "/aws/lambda/auth-cpf-${var.environment}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/authorizer-${var.environment}"
  retention_in_days = var.log_retention_days
}

# Valida o CPF, consulta o cliente no RDS e emite o JWT (ADR-004). Fica na VPC,
# nas subnets privadas, com o SG autorizado a conectar no banco.
resource "aws_lambda_function" "auth_cpf" {
  function_name    = "auth-cpf-${var.environment}"
  description      = "Autenticacao de cliente por CPF (${var.environment})"
  role             = local.lab_role_arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.auth_cpf.output_path
  source_code_hash = data.archive_file.auth_cpf.output_base64sha256
  memory_size      = 256
  timeout          = 10

  vpc_config {
    subnet_ids         = split(",", local.shared["private-subnet-ids"])
    security_group_ids = [local.shared["db-clients-sg-id"]]
  }

  environment {
    variables = {
      DB_HOST     = local.shared["db-host"]
      DB_PORT     = local.shared["db-port"]
      DB_NAME     = local.env["db-name"]
      DB_USER     = local.env["db-lambda-user"]
      DB_PASSWORD = data.aws_ssm_parameter.secret["db-lambda-password"].value
      JWT_SECRET  = data.aws_ssm_parameter.secret["jwt-secret"].value
    }
  }

  depends_on = [aws_cloudwatch_log_group.auth_cpf]
}

# Valida o JWT na borda. Não acessa o banco: fica fora da VPC (cold start menor).
resource "aws_lambda_function" "authorizer" {
  function_name    = "authorizer-${var.environment}"
  description      = "Lambda Authorizer do API Gateway (${var.environment})"
  role             = local.lab_role_arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.authorizer.output_path
  source_code_hash = data.archive_file.authorizer.output_base64sha256
  memory_size      = 128
  timeout          = 5

  environment {
    variables = {
      JWT_SECRET = data.aws_ssm_parameter.secret["jwt-secret"].value
    }
  }

  depends_on = [aws_cloudwatch_log_group.authorizer]
}
