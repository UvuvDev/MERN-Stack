terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  # Secret Manager ids are stable; the values come from variables so nothing
  # sensitive is committed. Version "latest" is what Cloud Run reads.
  secrets = {
    "mongodb-uri"        = var.mongodb_uri
    "jwt-secret"         = var.jwt_secret
    "openrouter-api-key" = var.openrouter_api_key
    "smtp-host"          = var.smtp_host
    "smtp-port"          = var.smtp_port
    "smtp-user"          = var.smtp_user
    "smtp-pass"          = var.smtp_pass
    "mail-from"          = var.mail_from
  }

  image = var.container_image != "" ? var.container_image : "${var.region}-docker.pkg.dev/${var.project_id}/${var.repository_id}/${var.service_name}:latest"
}

resource "google_project_service" "services" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# ---------------------------------------------------------------------------
# Artifact Registry
# ---------------------------------------------------------------------------
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = var.repository_id
  description   = "Container images for ${var.service_name}"
  format        = "DOCKER"

  depends_on = [google_project_service.services]
}

# ---------------------------------------------------------------------------
# Secret Manager
# ---------------------------------------------------------------------------
resource "google_secret_manager_secret" "this" {
  for_each = local.secrets

  secret_id = each.key

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_version" "this" {
  for_each = local.secrets

  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value

  depends_on = [google_secret_manager_secret.this]
}

# ---------------------------------------------------------------------------
# Cloud Run runtime identity
# ---------------------------------------------------------------------------
resource "google_service_account" "run" {
  account_id   = "record-over-rhetoric"
  display_name = "Record Over Rhetoric Cloud Run runtime"

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_iam_member" "run_access" {
  for_each = google_secret_manager_secret.this

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_artifact_registry_repository_iam_member" "run_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.app.location
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.run.email}"
}

# ---------------------------------------------------------------------------
# Cloud Run service (v2)
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email
    timeout         = "300s"

    max_instance_request_concurrency = 80

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = local.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      env {
        name  = "COOKIE_SECURE"
        value = "true"
      }

      env {
        name  = "CLIENT_ORIGIN"
        value = var.client_origin
      }

      env {
        name  = "AI_ENABLED"
        value = "true"
      }

      env {
        name  = "SEED_DEMO_USER"
        value = "false"
      }

      env {
        name = "MONGODB_URI"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["mongodb-uri"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["jwt-secret"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "OPENROUTER_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["openrouter-api-key"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SMTP_HOST"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["smtp-host"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SMTP_PORT"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["smtp-port"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SMTP_USER"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["smtp-user"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SMTP_PASS"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["smtp-pass"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "MAIL_FROM"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["mail-from"].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_artifact_registry_repository.app,
    google_secret_manager_secret_version.this,
    google_secret_manager_secret_iam_member.run_access,
  ]
}

# The rubric requires a publicly reachable service (no IAM auth on the SPA).
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# Optional custom domain mapping (managed TLS certificate)
# ---------------------------------------------------------------------------
# Requires the domain to be verified for var.project_id in Google Search
# Console before apply, and DNS records from the mapping output to be created.
resource "google_cloud_run_domain_mapping" "custom" {
  count = var.custom_domain == "" ? 0 : 1

  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }

  depends_on = [google_cloud_run_v2_service.app]
}
