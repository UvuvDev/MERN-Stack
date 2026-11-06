# Deployment — Record Over Rhetoric (GCP + MongoDB Atlas)

This guide deploys the MERN app to **Google Cloud Platform**: Cloud Run,
Artifact Registry, Secret Manager, and Cloud Build, with **MongoDB Atlas** as the
remote database.

> The course template mentions DigitalOcean. This project intentionally replaces
> it with GCP; no DigitalOcean resources are used.

The rubric requires a **domain name, not an IP address**. Sections 7A and 7B
cover the two supported ways to satisfy this.

---

## 1. Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js 22 + npm | Same major version as the Docker image. |
| Git repository | Cloud Build triggers need a connected repo. |
| Google Cloud project | Billing enabled; Owner or equivalent for first setup. |
| `gcloud` CLI | `gcloud auth login` and `gcloud config set project <PROJECT_ID>`. |
| Docker | Optional locally; Cloud Build builds the image in GCP. |
| Terraform >= 1.5 | Optional; `infra/terraform` provisions the same resources. |
| MongoDB Atlas account | Free M0 works for the course; M10+ for production. |
| Domain name | e.g. `recordoverrhetoric.app`; DNS access required. |
| OpenRouter API key | `sk-or-v1-...`; without one the app falls back to demo analyses. |
| SMTP credentials | Required for verification and password-reset e-mail in production. |

Set convenient shell variables for the rest of this guide:

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export REPO="record-over-rhetoric"
export SERVICE="record-over-rhetoric"
export DOMAIN="www.recordoverrhetoric.app"
export RUNTIME_SA="record-over-rhetoric@${PROJECT_ID}.iam.gserviceaccount.com"
```

---

## 2. MongoDB Atlas

1. Create a project, then a cluster (M0 free tier is enough for the course).
   Pick a region close to Cloud Run (`us-central1` or the nearest Atlas GCP
   region) and name the database `record_over_rhetoric`.
2. **Database Access → Add New Database User**
   - Username: `ror_app`
   - Password: generate a long random password and store it in a password
     manager.
   - Role: `Read and write to any database` (or scope it to
     `record_over_rhetoric`).
3. **Network Access → Add IP Address**
   - Cloud Run egress IPs are not static by default. The pragmatic course setup
     is `0.0.0.0/0` with a strong, least-privilege database user. Atlas still
     requires TLS and authentication.
   - Stricter option: attach a **Serverless VPC connector** to Cloud Run and use
     Atlas private endpoints (Private Service Connect or VPC peering). Then
     allow only the connector/private range.
4. **Connect → Drivers** and copy the SRV connection string:

   ```
   mongodb+srv://ror_app:<password>@cluster0.xxxxx.mongodb.net/record_over_rhetoric?retryWrites=true&w=majority&appName=record-over-rhetoric
   ```

   URL-encode special characters in the password (`@` → `%40`, `:` → `%3A`,
   `/` → `%2F`).

### TLS explanation

- `mongodb+srv://` implies `tls=true`; the Node.js driver negotiates TLS
  automatically.
- Atlas requires TLS 1.2+ and serves a publicly trusted certificate, so the
  driver verifies the chain by default. **Do not** set
  `tlsAllowInvalidCertificates` or `tlsInsecure`.
- If you use a non-SRV `mongodb://` host list, append `?tls=true`.
- Verify connectivity from your workstation:

  ```bash
  mongosh "mongodb+srv://ror_app:PASSWORD@cluster0.xxxxx.mongodb.net/record_over_rhetoric"
  ```

  A successful `db.runCommand({ ping: 1 })` confirms TLS and credentials.

Keep the URI out of shell history where possible; it goes into Secret Manager in
the next sections.

---

## 3. GCP project setup

```bash
gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com
```

Create the **runtime service account** (Terraform creates this automatically if
you use it):

```bash
gcloud iam service-accounts create record-over-rhetoric \
  --display-name="Record Over Rhetoric Cloud Run runtime"
```

Cloud Build's service account needs to deploy Cloud Run and act as the runtime
identity. For a course project the simplest grant is:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/artifactregistry.writer"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser"
```

---

## 4. Artifact Registry

```bash
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Record Over Rhetoric images"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
```

Terraform equivalent: `google_artifact_registry_repository.app` in
`infra/terraform/main.tf`.

---

## 5. Secret Manager

Create one secret per production value. The names below are referenced by
`cloudbuild.yaml` and `infra/terraform`.

| Secret id | Environment variable |
| --- | --- |
| `mongodb-uri` | `MONGODB_URI` |
| `jwt-secret` | `JWT_SECRET` |
| `openrouter-api-key` | `OPENROUTER_API_KEY` |
| `smtp-host` | `SMTP_HOST` |
| `smtp-port` | `SMTP_PORT` |
| `smtp-user` | `SMTP_USER` |
| `smtp-pass` | `SMTP_PASS` |
| `mail-from` | `MAIL_FROM` |

```bash
create_secret() {
  local name="$1" value="$2"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
}

create_secret mongodb-uri        "mongodb+srv://ror_app:...@cluster0.xxxxx.mongodb.net/record_over_rhetoric?retryWrites=true&w=majority"
create_secret jwt-secret         "$(openssl rand -base64 48)"
create_secret openrouter-api-key "sk-or-v1-..."
create_secret smtp-host          "smtp.example.com"
create_secret smtp-port          "587"
create_secret smtp-user          "apikey"
create_secret smtp-pass          "..."
create_secret mail-from          "Record Over Rhetoric <no-reply@recordoverrhetoric.app>"
```

Grant the runtime identity access to each secret:

```bash
for s in mongodb-uri jwt-secret openrouter-api-key smtp-host smtp-port smtp-user smtp-pass mail-from; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

The app reads secrets only at runtime. Do not bake them into the image and never
commit a `.env` or `terraform.tfvars`.

---

## 6. Build and deploy with Cloud Build

`cloudbuild.yaml` builds the multi-stage image, pushes `:<commit-sha>` and
`:latest` to Artifact Registry, then deploys Cloud Run with Secret Manager
environment references.

### Option A — Cloud Build trigger (recommended)

1. Connect the repository in **Cloud Build → Repositories**.
2. Create a trigger on the main branch using `cloudbuild.yaml`.
3. Add substitutions:
   - `_REGION` = `us-central1`
   - `_REPO` = `record-over-rhetoric`
   - `_SERVICE` = `record-over-rhetoric`
   - `_CLIENT_ORIGIN` = `https://www.recordoverrhetoric.app`
   - `_RUNTIME_SA` = `record-over-rhetoric@PROJECT_ID.iam.gserviceaccount.com`
   - `_MIN_INSTANCES` = `0`, `_MAX_INSTANCES` = `3`
4. Push to the branch. The trigger supplies `SHORT_SHA` automatically, so image
   tags match the commit.

### Option B — manual submit

Pass the commit SHA as `_TAG` so the image still gets a traceable tag (without
it, the pipeline falls back to `manual-<timestamp>`):

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_TAG="$(git rev-parse --short HEAD)",_REGION="$REGION",_REPO="$REPO",_SERVICE="$SERVICE",_CLIENT_ORIGIN="https://${DOMAIN}",_RUNTIME_SA="$RUNTIME_SA"
```

After the first push you can also deploy a specific local build:

```bash
IMG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}"
docker build -t "${IMG}:local" .
docker push "${IMG}:local"
gcloud run deploy "$SERVICE" \
  --image="${IMG}:local" --region="$REGION" \
  --service-account="$RUNTIME_SA" --allow-unauthenticated \
  --port=8080 --min-instances=0 --max-instances=3
```

`cloudbuild.yaml` sets `NODE_ENV=production`, `COOKIE_SECURE=true`,
`CLIENT_ORIGIN`, `AI_ENABLED=true`, and `SEED_DEMO_USER=false`. Override
`CLIENT_ORIGIN` if your domain differs.

### Option C — Terraform

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in real values
terraform init
terraform plan
terraform apply
```

Terraform can create Artifact Registry, all secrets and versions, the runtime
service account, the Cloud Run v2 service, public invoker IAM, and an optional
domain mapping. Because Cloud Run needs an existing image, either:

1. Push the image first, then `terraform apply`; or
2. Apply with `container_image = "us-docker.pkg.dev/cloudrun/container/hello"`
   and let Cloud Build update the service afterward.

Outputs include `service_url`, `runtime_service_account`,
`artifact_registry_repository`, `secret_ids`, and, when enabled,
`custom_domain_resource_records`.

---

## 7. Custom domain and managed TLS

Never present the `*.run.app` URL or an IP as the deliverable; the rubric
requires a domain. Choose one option.

### Option A — Cloud Run domain mapping (simplest)

1. Verify ownership of the domain (or `www`) in
   [Google Search Console](https://search.google.com/search-console) for the
   same Google account/project.
2. Create the mapping:

   ```bash
   gcloud run domain-mappings create \
     --service "$SERVICE" --domain "$DOMAIN" --region "$REGION"
   ```

3. Read the required DNS records:

   ```bash
   gcloud run domain-mappings describe \
     --domain "$DOMAIN" --region "$REGION"
   ```

   - Subdomain (recommended): `CNAME` → `ghs.googlehosted.com.`
   - Apex: use the `A`/`AAAA` records reported by the mapping.
4. Create the records at your DNS provider. Wait for propagation.
5. Cloud Run provisions a **Google-managed TLS certificate** automatically.
   Provisioning can take 15 minutes to 24 hours; check the mapping status until
   `CertificateProvisioned` is true.
6. Update `CLIENT_ORIGIN` to `https://${DOMAIN}` and redeploy. For the apex,
   redirect to `www` (or map the apex separately).

### Option B — external HTTPS load balancer + managed certificate

Use this for an apex domain, CDN, or a single front door across services.

```bash
# 1. Global static IP (this is a frontend IP, not a Cloud Run instance IP).
gcloud compute addresses create ror-lb-ip --global

# 2. Serverless NEG pointing at the Cloud Run service.
gcloud compute network-endpoint-groups create ror-neg \
  --region="$REGION" --network-endpoint-type=serverless \
  --cloud-run-service="$SERVICE"

# 3. Backend, URL map, managed certificate, HTTPS proxy, forwarding rule.
gcloud compute backend-services create ror-backend \
  --global --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend ror-backend \
  --global --network-endpoint-group=ror-neg \
  --network-endpoint-group-region="$REGION"

gcloud compute url-maps create ror-urlmap --default-service=ror-backend

gcloud compute ssl-certificates create ror-cert \
  --domains="$DOMAIN" --global

gcloud compute target-https-proxies create ror-https-proxy \
  --url-map=ror-urlmap --ssl-certificates=ror-cert

gcloud compute forwarding-rules create ror-https \
  --global --target-https-proxy=ror-https-proxy \
  --address=ror-lb-ip --ports=443
```

Add an HTTP `:80` forwarding rule and a URL map that redirects to HTTPS (or use
Cloud Run's built-in HTTP→HTTPS redirect on the mapped domain). Point the
domain's `A` record at the reserved global IP, wait for the managed certificate
to become `ACTIVE`, then update `CLIENT_ORIGIN` and redeploy.

If you want the load balancer to be the **only** ingress path, set the Cloud Run
service ingress to `internal-and-cloud-load-balancing`; otherwise `*.run.app`
remains publicly reachable.

> **Hand-off requirement:** the lead must verify the domain, create the DNS
> records, and wait for certificate provisioning before the final demo.

---

## 8. Environment variables

Production values come from Cloud Build (`--set-env-vars`) and Secret Manager
(`--set-secrets`). Local values come from `docker-compose.yml` or
`server/.env`, based on `server/.env.example`.

| Variable | Production source | Notes |
| --- | --- | --- |
| `PORT` | Cloud Run | `8080` |
| `NODE_ENV` | `--set-env-vars` | `production` |
| `MONGODB_URI` | Secret `mongodb-uri` | SRV URI, TLS automatic |
| `JWT_SECRET` | Secret `jwt-secret` | 32+ random bytes |
| `JWT_EXPIRES_IN` | app default | `7d` |
| `CLIENT_ORIGIN` | `--set-env-vars` | Public HTTPS origin, comma-separated if needed |
| `COOKIE_SECURE` | `--set-env-vars` | `true` on HTTPS |
| `OPENROUTER_API_KEY` | Secret `openrouter-api-key` | Absent → demo/fake AI |
| `OPENROUTER_BASE_URL` | app default | `https://openrouter.ai/api/v1` |
| `AI_MODEL_MINIMAX` / `AI_MODEL_DEEPSEEK` / `AI_MODEL_GROK` | app defaults | Override model ids if needed |
| `AI_ENABLED` | `--set-env-vars` | `true` |
| `AI_FAKE` | app default | `false` in prod; `true` locally/tests |
| `AI_TIMEOUT_MS` | app default | `75000` per model |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Secret Manager | Transactional e-mail |
| `MAIL_FROM` | Secret `mail-from` | From header |
| `SEED_DEMO_USER` | `--set-env-vars` | `false` in prod |

Change a secret with a new version, then deploy a new revision (Cloud Run pins
the resolved secret version at revision creation). Triggering the Cloud Build
job again is the simplest way:

```bash
printf '%s' "new-value" | gcloud secrets versions add jwt-secret --data-file=-
# Re-run the Cloud Build trigger (or `gcloud builds submit` with _TAG=...).
```

---

## 9. Local development with Docker Compose

```bash
# MongoDB 7 + Express API (Node watch) with hot reload
docker compose up --build

# In another terminal, run the Vite dev server on the host.
# It proxies /api to http://localhost:8080.
npm run dev -w client
```

Or run the client in Docker too (Vite shares the API container's network
namespace, so its existing proxy works):

```bash
docker compose --profile client up --build
# http://localhost:5173
```

Compose starts MongoDB with a persistent named volume and a healthcheck; the API
waits for it. Defaults: `AI_FAKE=true` (no API key required),
`CLIENT_ORIGIN=http://localhost:5173`, `COOKIE_SECURE=false`.

Seed the database (idempotent; add `-- --reset` to wipe first):

```bash
docker compose exec server npm run seed -w server
docker compose exec server npm run seed -w server -- --reset
```

Demo account: `demo@recordoverrhetoric.app` / `CompareVotes!2026`.

To use a real OpenRouter key locally, export it before starting Compose:

```bash
OPENROUTER_API_KEY="sk-or-v1-..." AI_FAKE=false docker compose up
```

---

## 10. Seeding remote MongoDB Atlas

Seed from your workstation against Atlas (temporarily allow your IP in Atlas
Network Access), or from a one-off Cloud Run Job using the deployed image:

```bash
export MONGODB_URI="mongodb+srv://ror_app:...@cluster0.xxxxx.mongodb.net/record_over_rhetoric"
npm run seed -w server -- --reset
```

The seed is fictional (`isSample: true`) and upserts offices, bills, candidates,
votes, and the verified demo user. Set `SEED_DEMO_USER=false` to skip the demo
account.

### Import real congressional voting records

The importer pulls per-member positions from Voteview's public roll-call CSVs
and can enrich bills from the Congress.gov API. It writes directly to whichever
`MONGODB_URI` it is given, so run it from your workstation against Atlas (allow
your IP temporarily) or from a one-off Cloud Run Job using the deployed image:

```bash
# Fictional demo + real Florida records
npm run seed -w server
npm run import:real -w server -- --state=FL --limit=120

# Real data only (clears users, comparisons, and sample records first)
npm run seed -w server -- --reset
npm run import:real -w server -- --state=FL --limit=120

# Add official Congress.gov titles, summaries, and policy areas
CONGRESS_API_KEY="your-key" npm run import:real -w server --   --state=FL --limit=120 --enrich
```

Notes:

- Voteview requires no key; the Congress.gov key is optional and free.
- Downloads are cached in `server/.cache/` (git-ignored) locally. The production
  image sets `IMPORT_CACHE_DIR=/tmp/ror-cache` because it runs as a non-root user;
  mount a volume there if you want the cache to persist across runs.
- Use `--dry-run` to preview counts, `--all-states` for the whole Congress, and
  `--reset` to remove previously imported real records.
- For a Cloud Run Job, override the container command with
  `node src/import/import-real.js --state=FL --limit=120 --enrich` and give the
  job the same `MONGODB_URI` and `CONGRESS_API_KEY` secrets as the service.
- Importing all states and all roll calls creates a large vote collection; the
  `--limit` flag keeps the demo fast and the AI prompt focused.

---

## 11. Lighthouse audit procedure

1. Deploy to the custom HTTPS domain and warm the service (`curl` the home page)
   so the audit does not measure a cold start.
2. Open Chrome → Incognito. Disable extensions. Clear site data.
3. DevTools → **Lighthouse**.
   - Mode: Navigation
   - Device: **Mobile**, run; then **Desktop**, run.
   - Categories: Performance, Accessibility, Best Practices, SEO.
4. Run each mode three times and report the median / best stable run. The target
   is **95+** in all four categories for desktop and mobile.
5. Investigate regressions with the generated JSON report; common causes:
   - Render-blocking scripts → keep routes code-split and CSS small.
   - Missing image dimensions → the UI uses initials/SVG, so avoid new images.
   - Contrast → keep the design tokens at 4.5:1 or better.
   - Missing meta description / favicon → already supplied in `client/index.html`.
   - Cookie/secure warnings → ensure the audit URL is HTTPS with a valid cert.
6. Record the scores and screenshots for the submission. Lighthouse cannot audit
   a bare IP; use the domain.

---

## 12. SwaggerHub import (OpenAPI 3.0)

1. Confirm the live document is valid JSON:
   `https://<DOMAIN>/api/openapi.json`.
2. In SwaggerHub: **Create New → Import API**.
3. Choose **Import from URL**, paste `https://<DOMAIN>/api/openapi.json`, set
   owner/API name (`record-over-rhetoric`), version `1.0.0`, visibility Public.
4. If URL import is blocked, download the JSON and upload it instead.
5. Verify the three model keys, auth endpoints, and comparison schemas render.
   The interactive Swagger UI is served by the app at `https://<DOMAIN>/api/docs`.
6. Note in the presentation that the document is generated from the same Express
   routes the app uses, not hand-maintained separately.

---

## 13. Mobile hand-off

The mobile client is intentionally out of scope for this repository. The API is
already bearer-token ready; see [`mobile/README.md`](../mobile/README.md).

Key points for the teammate:

- `POST /api/auth/login` returns `{ token, user }`. Store `token` in
  `expo-secure-store` and send `Authorization: Bearer <token>`.
- No CSRF token is needed for bearer requests.
- Add the Expo origin to the comma-separated `CLIENT_ORIGIN` value (native
  requests without an `Origin` header are allowed).
- Base URLs: Android emulator `http://10.0.2.2:8080/api`, iOS simulator
  `http://localhost:8080/api`, production `https://<DOMAIN>/api`.
- Deep links for `/verify-email?token=...` and `/reset-password?token=...`.
- The JSON contract and the OpenAPI document are the source of truth.

---

## 14. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Cloud Run revision fails to start with a secret error | Secret has no enabled version, or runtime SA lacks `secretmanager.secretAccessor`. |
| `MongoServerSelectionError` / timeout | Atlas IP access list missing Cloud Run egress; wrong URI; unencoded password; cluster paused. |
| TLS/certificate errors to Atlas | URI is non-SRV without `tls=true`, or a custom CA is required; do not disable verification. |
| 401 after deploy | `CLIENT_ORIGIN` differs from the visited origin, or `COOKIE_SECURE=true` while testing over HTTP. |
| Domain shows `CertificatePending` | DNS not propagated, domain not verified, or CNAME/A records wrong. |
| 502/503 from Cloud Run | Container not listening on `$PORT` (8080) or health check failing; inspect Cloud Logging. |
| AI tabs all fail | Invalid/expired OpenRouter key or `AI_ENABLED=false`; check logs. Set `AI_FAKE=true` for a demo fallback. |
| Verification e-mail not delivered | SMTP secrets are wrong/blocked; check provider app-password and port (587 STARTTLS / 465 TLS). |
| Slow first request | Scale-to-zero cold start; warm the service before the demo or set `min_instances=1` temporarily. |
