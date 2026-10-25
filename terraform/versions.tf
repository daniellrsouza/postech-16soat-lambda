terraform {
  required_version = ">= 1.15.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }

  # bucket e key vêm de `terraform init -backend-config=...` (scripts/tf.sh):
  # key = lambda/<ambiente>.tfstate
  backend "s3" {
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "postech-16soat"
      Repository  = "postech-16soat-lambda"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
