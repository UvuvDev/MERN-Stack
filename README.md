# Record Over Rhetoric

**Judge candidates by their votes, not their ads.**

Record Over Rhetoric is a MERN-stack web application that lets you pick two candidates for the same office and compare them using **only their recorded votes on bills** — never their platforms, speeches, party messaging, or campaign rhetoric. A panel of three independent AI models reads the same evidence-bound prompt and reports where the records agree, where they diverge, and how confident the evidence supports each conclusion.

> The seeded dataset is **fictional sample data** (clearly flagged `isSample`) so the app can be demonstrated without implying anything about real people. Run the real-data importer to load actual U.S. House and Senate roll-call records, including historical Congresses for race comparisons.

---

## Live deployment

- **URL:** https://poosd.shuroko-exe.dev
- **Host:** GCP Compute Engine VM, Docker containers for the API and MongoDB, Apache TLS reverse proxy, Let's Encrypt certificate, Mailgun SMTP.

The previous LAMP app and its PHP/MariaDB services on that VM are stopped; do not re-run the other project's Ansible/Terraform workflow against this VM while the MERN app is live.

## Table of contents

- [Features](#features)
- [Why three models](#why-three-models)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Demo account](#demo-account)
- [Races](#races)
- [Real congressional data](#real-congressional-data)
- [Scripts](#scripts)
- [API and Swagger](#api-and-swagger)
- [Testing](#testing)
- [Production deployment (GCP)](#production-deployment-gcp)
- [Docker](#docker)
- [Adding the mobile app](#adding-the-mobile-app)
- [Security and course requirements](#security-and-course-requirements)
- [Project documentation](#project-documentation)

---

## Features

- The main builder is sign-in first; `/login` is the landing page, with registration and password recovery.
- Browse 2026 races, offices, candidates, and full roll-call vote histories.
- Race-first comparison builder: pick a race and the two nominees are preselected (manual office pairing still works).
- Import real U.S. House and Senate records (Voteview positions + optional Congress.gov bill metadata).
- Pair two candidates for the same office and generate a three-model analysis.
- Each model returns a neutral summary, topic-by-topic comparison, strengths/concerns, shared votes, notable votes, and a confidence level — every claim tied to a bill number, with the bill's title always shown. Each briefing also includes a "Bills cited" reference list with titles, neutral summaries, and source links.
- Priority measures: the Epstein Files Transparency Act and the Epstein amendment to S.2296 are loaded explicitly, included in every prompt, and shown with their procedural context (including votes to table and no-vote states).
- Comparison history saved per user.
- Account creation with **e-mail verification** and **forgotten-password recovery**.
- Cookie-based sessions for the web app and bearer tokens for the future mobile app.
- Accessible, responsive, Lighthouse-minded UI with no external fonts or images.
- Deterministic demo mode (`AI_FAKE=true`) so the app works without an OpenRouter key.

## Why three models

Any single LLM can misread a record. Three models receiving an identical, citation-constrained prompt expose disagreement and reduce the chance that one hallucination is mistaken for analysis. The comparison is presented as an AI-assisted reading of the record, **not an endorsement**.

| Panel | Display name | Default OpenRouter model |
| --- | --- | --- |
| `minimax` | MiniMax M3 Flash | `minimax/minimax-m3.1-flash` |
| `deepseek` | DeepSeek 4.1 Flash | `deepseek/deepseek-v4.1-flash` |
| `grok` | Grok 4.3 (cheap xAI tier) | `x-ai/grok-4.3` |

All three are configurable with `AI_MODEL_MINIMAX`, `AI_MODEL_DEEPSEEK`, and `AI_MODEL_GROK`.

## Architecture

Monorepo with npm workspaces:

```
server/          Express 4 + Mongoose 8 REST API, auth, AI panel, seeds, tests
client/          React 18 + Vite 5 single-page app
mobile/          Hand-off notes for the teammate building React Native later
infra/           Terraform for GCP (Artifact Registry, Cloud Run, secrets, domain)
docs/            Spec, deployment guide, architecture, presentation diagrams
scripts/         setup.sh — one-command local bootstrap
Dockerfile       Multi-stage production image (builds client, runs API)
docker-compose   Local MongoDB + dev server (+ optional Vite container)
```

Request flow: React (AJAX/JSON) → Express API → MongoDB Atlas (TLS) and → OpenRouter (three parallel model calls). In production, Express serves both the API and the built SPA from one HTTPS origin on Cloud Run.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).

## Quick start

**Prerequisites:** Node 22.12+ (or 24+), npm 10+, and either Docker or an existing MongoDB/Atlas instance.

### One-command setup

```bash
./scripts/setup.sh
npm run dev
```

The script installs dependencies, creates `server/.env` (generating a JWT secret), starts MongoDB in Docker, seeds the demo data, and prints the URLs. It will not overwrite an existing `.env`.

Useful flags:

```bash
./scripts/setup.sh --real --state=FL   # also import real House/Senate records
./scripts/setup.sh --real-only --state=FL   # real records only
CONGRESS_API_KEY=... ./scripts/setup.sh --real --state=FL --enrich   # + official bill metadata
./scripts/setup.sh --reset             # wipe before seeding
./scripts/setup.sh --atlas="$ATLAS_URI"   # use Atlas instead of Docker
./scripts/setup.sh --start             # set up, then run npm run dev
MONGODB_URI="$ATLAS_URI" OPENROUTER_API_KEY="sk-or-..." ./scripts/setup.sh
```

Run `./scripts/setup.sh --help` for all options. It is safe to re-run.

### Manual setup

```bash
# 1. Install dependencies (npm workspaces)
npm install

# 2. Configure the server
cp server/.env.example server/.env
# edit server/.env: set MONGODB_URI, JWT_SECRET, and OPENROUTER_API_KEY
# leave SMTP blank to print verification/reset e-mails to the console
# set AI_FAKE=true to run without an OpenRouter key

# 3. Seed offices, candidates, bills, votes, and the demo user
npm run seed

# 4. Run API + web client with hot reload
npm run dev
# API:  http://localhost:8080
# Web:  http://localhost:5173
```

Use a local MongoDB if you do not have Atlas yet:

```bash
docker run -d --name ror-mongo -p 27017:27017 mongo:7
# then in server/.env:
# MONGODB_URI=mongodb://127.0.0.1:27017/record_over_rhetoric
```

`npm run seed -- --reset` clears and reseeds. The seed is idempotent.

## Demo account

```
E-mail:   demo@recordoverrhetoric.app
Password: CompareVotes!2026
```

Seeded only when `SEED_DEMO_USER` is not `false`.

## Races

The builder is race-first. A race links an election year, an office, and its candidates; the resulting comparison stores the race so it appears in history and on the briefing. Registered races live in `server/src/import/races.js` and are loaded with:

```bash
npm run import:races
```

All **35 Senate races on the 2026 map** are registered from `server/src/import/races-2026.json`. Three have both nominees' federal voting records and are ready to compare: **Alaska**, **Georgia**, and **Ohio**. The other 32 are still listed, with an explicit **records incomplete** status naming the nominee who has never held federal office, because a voting-record-only comparison needs two records.

Every state is also available as an office. After loading all states, the office picker has all 50 Senate and 50 House offices, so you can compare any state's current delegation even when its 2026 race is incomplete.

Load the full map from a clean database with:

```bash
npm run import:real -- --all-states --chamber=senate --congress=118 --limit=80 --enrich
npm run import:real -- --all-states --chamber=senate --congress=119 --limit=80 --enrich
npm run import:real -- --all-states --chamber=house --congress=118 --limit=80 --enrich
npm run import:real -- --all-states --chamber=house --congress=119 --limit=80 --enrich
npm run import:races
```

The Ohio race is Husted (119th) vs. Brown (118th); Georgia is Ossoff (Senate) vs. Mike Collins (House); Alaska is Peltola (House) vs. Sullivan (Senate). For mixed-chamber or cross-Congress races, the prompt matches bills by number and Congress and does not invent shared votes.

Add or correct races in `server/src/import/races-2026.json`, then run `npm run import:races`.

### Priority measures

Two high-salience measures are always loaded and explicitly covered in the prompt:

```bash
npm run import:priority
```

- **H.R. 4405 — Epstein Files Transparency Act**: House roll 289, 427–1; Senate passed by unanimous consent, so there is no Senate roll-call position.
- **Epstein documents amendment to S.2296**: Senate roll 512, motion to table, 51–49. Sullivan voted Yea (to table), Husted Yea, Ossoff Nay.

The priority section is sourced from the full candidate record, not the 60-vote prompt sample. Procedural votes are labeled as such; the app never infers a position from a voice vote or unanimous consent. Edit the registry in `server/src/import/priority-measures.js` to add more measures.

## Real congressional data

The app ships with fictional sample data, but you can load real roll-call records:

```bash
npm run import:real -- --state=FL --limit=80
```

- **Positions:** [Voteview (UCLA)](https://voteview.com/) public roll-call CSVs for the U.S. House and Senate, 119th Congress. No API key required.
- **Bill metadata:** the official [Congress.gov API](https://api.congress.gov/) (free key) adds official titles, CRS summaries, and policy areas when you pass `--enrich`.
- Defaults: Florida, both chambers, the 80 most substantive roll calls per chamber.
- Real records are marked `isSample: false` and use `real-` office slugs, so they sit alongside the fictional seed data. Add `--purge-sample` to remove the fictional offices, candidates, bills, and votes (the demo user is kept).
- House records are grouped under "U.S. House — <State> (all districts)" so any two representatives from the state can be compared; the Senate office is the state's two senators.
- One recorded vote is stored per candidate and bill (the most substantive roll call). Comparisons use up to the 60 most recent votes per candidate to keep prompts and costs bounded.
- `--dry-run` prints counts without writing. `--reset` removes previously imported real records. `--all-states` imports every state.

```bash
# Official bill metadata (titles, CRS summaries, policy areas)
CONGRESS_API_KEY=your_key npm run import:real -- --state=FL --limit=120 --enrich
```

Voteview does not require an account and is the practical source for per-member Senate positions; the Congress.gov API exposes House roll calls but not individual Senate positions. The importer caches downloads under `server/.cache/` (git-ignored).

## Scripts

| Command | Description |
| --- | --- |
| `npm run setup` | One-command bootstrap (`./scripts/setup.sh`) |
| `npm run dev` | API (`:8080`) + Vite client (`:5173`) concurrently |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API (serves `client/dist` when `NODE_ENV=production`) |
| `npm test` | Vitest + Supertest integration suite against an in-memory MongoDB |
| `npm run seed` | Seed sample data (add `-- --reset` to wipe first) |
| `npm run import:real` | Import real House/Senate voting records (`--state=FL`, `--enrich`, `--dry-run`) |
| `npm run import:races` | Register known races from `server/src/import/races-2026.json` |
| `npm run import:priority` | Load the Epstein priority measures and their recorded roll-call votes |
| `npm run email:test` | Send a test e-mail using the configured SMTP settings (`--to=...`) |
| `npm run lint` | Syntax checks for server and client config |

## API and Swagger

Base path: `/api`. Full contract: [`docs/PROJECT_SPEC.md` §8](docs/PROJECT_SPEC.md#8-rest-api-contract).

- Swagger UI: `http://localhost:8080/api/docs`
- OpenAPI 3.0 JSON: `http://localhost:8080/api/openapi.json`
- Health: `http://localhost:8080/api/health`

For the course's SwaggerHub requirement, import the OpenAPI JSON into SwaggerHub (File → Import → OpenAPI) and demonstrate the endpoint there.

Authentication supports both:
- Web: httpOnly `ror_token` cookie set by `POST /api/auth/login`.
- Native/mobile: the `token` field in the login response, sent as `Authorization: Bearer <token>`.

## Testing

```bash
npm test
```

The suite spins up an in-memory MongoDB via `mongodb-memory-server`, runs every API endpoint through Supertest, and uses deterministic AI fixtures (`AI_FAKE=1`). It covers registration/verification, login for verified and unverified users, password reset, candidate browsing, comparison creation, ownership checks, rate limits, OpenAPI/Swagger, 404 handling, and the real-data/race/priority helpers (67 tests).

## Production deployment (GCP)

The course template mentions DigitalOcean; this project intentionally uses **Google Cloud Platform** instead. The database is remote **MongoDB Atlas** with TLS.

Step-by-step instructions: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Summary:

1. Create an Atlas cluster and copy the `mongodb+srv://` URI.
2. Enable Cloud Run, Artifact Registry, Secret Manager, and Cloud Build.
3. Store `MONGODB_URI`, `JWT_SECRET`, `OPENROUTER_API_KEY`, and SMTP values in Secret Manager (or apply `infra/terraform`).
4. Deploy with Cloud Build (`cloudbuild.yaml`) to Cloud Run.
5. Map a verified custom domain (Cloud Run domain mapping or an HTTPS load balancer with a managed certificate) — the rubric requires a domain, not an IP.
6. Set `CLIENT_ORIGIN` to the HTTPS domain, `COOKIE_SECURE=true`, and `SEED_DEMO_USER` as needed.

HTTPS terminates at Cloud Run / the load balancer; Cloud Run → Atlas uses TLS. Detailed TLS and IAM notes are in the deployment guide.

## Docker

```bash
# Production image: builds the SPA and serves it with the API from one origin
docker build -t record-over-rhetoric .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e JWT_SECRET=change-me \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/record_over_rhetoric" \
  -e CLIENT_ORIGIN=http://localhost:8080 \
  -e COOKIE_SECURE=false \
  -e AI_FAKE=true \
  record-over-rhetoric

# Local full dev stack
docker compose up --build
docker compose --profile client up --build   # includes Vite in Docker
```

The production image runs as a non-root user, contains no dev dependencies, and exposes a `/api/health` health check.

## Adding the mobile app

The mobile client is intentionally left for a teammate. The API is ready for it today: bearer tokens, CORS allow-listing, stable JSON responses, deep-linkable verification/reset tokens, and a live OpenAPI document. See [`mobile/README.md`](mobile/README.md) for the hand-off.

## Security and course requirements

| Course requirement | Implementation |
| --- | --- |
| Remote database | MongoDB Atlas over TLS |
| MERN only | MongoDB, Express, React, Node (no Vue/Angular/Firebase) |
| JSON + AJAX client | React SPA calling `/api` with `fetch` |
| SwaggerHub demo | OpenAPI 3.0 document + Swagger UI |
| E-mail verification | Hashed, expiring tokens sent by Nodemailer |
| Password recovery | Hashed, expiring reset tokens |
| Unit test per endpoint | 50 integration tests across all endpoints |
| Remote host + domain | GCP Cloud Run + verified custom domain |
| Mobile app | Hand-off documented; API mobile-ready |
| Lighthouse 95+ | Lightweight bundle (~70 kB gzip JS), system fonts, no images, accessible markup |
| Extra credit | TLS everywhere, Docker, multi-model AI integration, security headers, rate limiting |

Additional hardening: bcrypt (12 rounds), JWT in httpOnly/SameSite cookies (bearer for native), Zod validation, helmet, CORS allow-list, comparison rate limiting, ownership checks on saved comparisons, and no secrets in the repository.

## Project documentation

- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) — build contract, data model, API.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — GCP + Atlas deployment.
- [`docs/EMAIL_SETUP.md`](docs/EMAIL_SETUP.md) — real SMTP, Mailpit, Gmail, and transactional providers.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — component and sequence diagrams, TLS story.
- [`docs/diagrams/`](docs/diagrams) — ERD, use case, sequence, class diagram, Gantt chart for the presentation.
- [`mobile/README.md`](mobile/README.md) — mobile hand-off.

---

**AI disclosure:** This project uses three large language models through OpenRouter to interpret voting records. It also used AI coding assistants during development. The application never sends candidate platforms, biographies, or rhetoric to any model; only bill metadata and recorded vote positions are sent. AI output is labeled as interpretation, not fact, and the app surfaces which model produced each result so disagreements remain visible.
