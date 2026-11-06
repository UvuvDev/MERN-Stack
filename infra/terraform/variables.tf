variable "project_id" {
  description = "GCP project id that hosts Cloud Run, Artifact Registry and Secret Manager."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Artifact Registry and the domain mapping."
  type        = string
  default     = "us-central1"
}

variable "repository_id" {
  description = "Artifact Registry Docker repository id."
  type        = string
  default     = "record-over-rhetoric"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,62}$", var.repository_id))
    error_message = "repository_id must be lowercase alphanumeric with hyphens."
  }
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "record-over-rhetoric"
}

variable "container_image" {
  description = "Full image reference. Leave empty to use <region>-docker.pkg.dev/<project>/<repo>/<service>:latest."
  type        = string
  default     = ""
}

variable "client_origin" {
  description = "Public HTTPS origin of the SPA, used for CORS and e-mail links."
  type        = string
  default     = "https://recordoverrhetoric.app"
}

variable "min_instances" {
  description = "Cloud Run minimum instances (0 allows scale-to-zero)."
  type        = number
  default     = 0

  validation {
    condition     = var.min_instances >= 0 && var.min_instances <= 10
    error_message = "min_instances must be between 0 and 10."
  }
}

variable "max_instances" {
  description = "Cloud Run maximum instances."
  type        = number
  default     = 3

  validation {
    condition     = var.max_instances >= 1 && var.max_instances <= 100
    error_message = "max_instances must be between 1 and 100."
  }
}

variable "custom_domain" {
  description = "Optional custom domain to map, e.g. www.recordoverrhetoric.app. Empty disables the mapping."
  type        = string
  default     = ""
}

# --- Secret values ---------------------------------------------------------
# Provide real values in terraform.tfvars (git-ignored). Never commit them.

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string (mongodb+srv://...)."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Long random string used to sign JWTs."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "jwt_secret must be at least 32 characters."
  }
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for the three-model AI panel."
  type        = string
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP host used for verification and password-reset e-mail."
  type        = string
}

variable "smtp_port" {
  description = "SMTP port (587 for STARTTLS, 465 for implicit TLS)."
  type        = string
  default     = "587"
}

variable "smtp_user" {
  description = "SMTP username."
  type        = string
  sensitive   = true
}

variable "smtp_pass" {
  description = "SMTP password or app-specific token."
  type        = string
  sensitive   = true
}

variable "mail_from" {
  description = "From header for transactional e-mail."
  type        = string
  default     = "Record Over Rhetoric <no-reply@recordoverrhetoric.app>"
}
