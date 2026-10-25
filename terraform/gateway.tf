# Rotas e authorizer da HTTP API do ambiente (D14). A API, o stage e a
# integração com a aplicação no EKS são do repo postech-16soat-infra-k8s.
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id                            = local.api_id
  name                              = "jwt-${var.environment}"
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.authorizer.invoke_arn
  identity_sources                  = ["$request.header.Authorization"]
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  # Sem cache: um token expirado é recusado no mesmo instante.
  authorizer_result_ttl_in_seconds = 0
}

resource "aws_apigatewayv2_integration" "auth_cpf" {
  api_id                 = local.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth_cpf.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "auth_cpf" {
  api_id    = local.api_id
  route_key = "POST /auth/cpf"
  target    = "integrations/${aws_apigatewayv2_integration.auth_cpf.id}"
}

locals {
  app_target = "integrations/${local.env["apigateway-app-integration"]}"

  # Rotas da aplicação liberadas sem token (equivalentes ao permitAll do
  # SecurityConfig): login de funcionários, links públicos do e-mail de
  # orçamento, health check e documentação.
  rotas_publicas_app = [
    "POST /auth/login",
    "ANY /api/public/{proxy+}",
    "GET /ping",
    "GET /actuator/health",
    "GET /actuator/health/{proxy+}",
    "GET /swagger-ui.html",
    "GET /swagger-ui/{proxy+}",
    "GET /v3/api-docs",
    "GET /v3/api-docs/{proxy+}",
  ]
}

resource "aws_apigatewayv2_route" "app_publica" {
  for_each = toset(local.rotas_publicas_app)

  api_id    = local.api_id
  route_key = each.value
  target    = local.app_target
}

# Todo o resto da aplicação exige token válido (cliente ou funcionário).
resource "aws_apigatewayv2_route" "app_protegida" {
  api_id             = local.api_id
  route_key          = "ANY /{proxy+}"
  target             = local.app_target
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_lambda_permission" "auth_cpf" {
  statement_id  = "ApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_cpf.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${local.env["apigateway-execution-arn"]}/*/*"
}

resource "aws_lambda_permission" "authorizer" {
  statement_id  = "ApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${local.env["apigateway-execution-arn"]}/authorizers/${aws_apigatewayv2_authorizer.jwt.id}"
}

output "auth_cpf_function" {
  value = aws_lambda_function.auth_cpf.function_name
}

output "authorizer_function" {
  value = aws_lambda_function.authorizer.function_name
}
