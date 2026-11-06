output "service_url" {
  description = "Default Cloud Run HTTPS URL (use the custom domain for the course demo)."
  value       = google_cloud_run_v2_service.app.uri
}

output "service_name" {
  description = "Cloud Run service name."
  value       = google_cloud_run_v2_service.app.name
}

output "runtime_service_account" {
  description = "Runtime service account e-mail for Cloud Build's _RUNTIME_SA substitution."
  value       = google_service_account.run.email
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository path for docker push."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "image_reference" {
  description = "Fully qualified image reference deployed by this configuration."
  value       = local.image
}

output "secret_ids" {
  description = "Secret Manager secret ids created for the service."
  value       = sort(keys(google_secret_manager_secret.this))
}

output "custom_domain" {
  description = "Mapped custom domain, or an empty string when disabled."
  value       = var.custom_domain
}

output "custom_domain_resource_records" {
  description = "DNS records reported by the Cloud Run domain mapping (create these at your DNS provider)."
  value       = try(google_cloud_run_domain_mapping.custom[0].status[0].resource_records, [])
}
