terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    confluent = {
      source  = "confluentinc/confluent"
      version = "~> 1.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ------------------------------------------------------------------------------
# 1. DistSQL Database (RDS PostgreSQL as DistSQL backend)
# ------------------------------------------------------------------------------
resource "aws_db_instance" "distsql_main" {
  allocated_storage    = 20
  db_name              = "capturehub_distsql"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.micro"
  username             = var.db_username
  password             = var.db_password
  skip_final_snapshot  = true
  publicly_accessible  = false
}

# ------------------------------------------------------------------------------
# 2. VectorDB (Using abstracted AWS OpenSearch Serverless / Pinecone)
# Placeholder for vector DB infrastructure
# ------------------------------------------------------------------------------
// resource "aws_opensearchserverless_collection" "vector_db" {
//   name = "capturehub-vector"
//   type = "VECTORSEARCH"
// }

# ------------------------------------------------------------------------------
# 3. Event Mesh (Confluent Cloud / MSK Placeholder)
# ------------------------------------------------------------------------------
// resource "confluent_kafka_cluster" "event_mesh" {
//   display_name = "capturehub-events"
//   availability = "SINGLE_ZONE"
//   cloud        = "AWS"
//   region       = var.aws_region
//   standard {}
// }

output "distsql_endpoint" {
  value = aws_db_instance.distsql_main.endpoint
}
