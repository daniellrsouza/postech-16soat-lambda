variable "environment" {
  description = "Ambiente: homolog (branch develop) ou prod (branch main)"
  type        = string

  validation {
    condition     = contains(["homolog", "prod"], var.environment)
    error_message = "environment deve ser homolog ou prod."
  }
}

variable "aws_region" {
  description = "Região AWS"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefixo dos parâmetros SSM (igual ao dos repositórios de infra)"
  type        = string
  default     = "tech-challenge"
}

variable "dist_dir" {
  description = "Diretório com os bundles gerados por `npm run build`"
  type        = string
  default     = "../dist"
}

variable "log_retention_days" {
  description = "Retenção dos logs das funções no CloudWatch"
  type        = number
  default     = 7
}
