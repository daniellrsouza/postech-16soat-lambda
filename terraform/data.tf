# Contrato via SSM (P4): rede e API publicadas pelo infra-k8s; banco e
# segredos do ambiente publicados pelo infra-db (P5).
data "aws_ssm_parameter" "shared" {
  for_each = toset(["private-subnet-ids", "db-clients-sg-id", "db-host", "db-port"])
  name     = "/${var.project_name}/shared/${each.key}"
}

data "aws_ssm_parameter" "env" {
  for_each = toset([
    "apigateway-api-id",
    "apigateway-execution-arn",
    "apigateway-app-integration",
    "db-name",
    "db-lambda-user",
  ])
  name = "/${var.project_name}/${var.environment}/${each.key}"
}

data "aws_ssm_parameter" "secret" {
  for_each        = toset(["db-lambda-password", "jwt-secret"])
  name            = "/${var.project_name}/${var.environment}/${each.key}"
  with_decryption = true
}

data "aws_caller_identity" "current" {}

locals {
  shared = { for k, p in data.aws_ssm_parameter.shared : k => p.value }
  env    = { for k, p in data.aws_ssm_parameter.env : k => p.value }

  # AWS Academy: só existe a LabRole.
  lab_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/LabRole"

  api_id = local.env["apigateway-api-id"]
}
