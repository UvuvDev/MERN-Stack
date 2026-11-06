# Record Over Rhetoric — Project Specification & Build Contract

> **One-line pitch:** Pick two candidates for the same office and an AI panel compares them **solely on their roll-call votes on bills** — never their platforms, ads, speeches, or party rhetoric.

This document is the authoritative contract for all five build agents. If a detail is not specified here, follow the conventions of the file you are editing and keep the implementation boring, accessible, and production-minded.

---

## 1. Product summary

- Public visitors can browse offices, candidates, and individual vote histories.
- Authenticated users (e-mail verified) can run a comparison of two candidates for the same office.
- A comparison is sent to **three OpenRouter models in parallel**:
  | Internal key | Display name | Default OpenRouter model id |
  | --- | --- | --- |
  | `minimax` | MiniMax M3 Flash | `minimax/minimax-m3.1-flash` |
  | `deepseek` | DeepSeek 4.1 Flash | `deepseek/deepseek-v4.1-flash` |
  | `grok` | Grok 4.3 (cheap xAI tier) | `x-ai/grok-4.3` |
  All three ids are overridable via env vars. Each model receives the **same** prompt built only from bill text (number, title, neutral summary, topics) and each candidate's recorded position (`yes`, `no`, `abstain`, `absent`).
- The UI shows the three analyses side by side (tabs/cards), a topic-by-topic breakdown, shared votes, and a clear methodology/disclaimer.
- Comparisons are saved per user and viewable in a history page.

**Hard rule:** the AI prompt must include no platform, biography, slogan, endorsement, or rhetoric fields. The `bio`/`officialUrl` fields exist for candidate identification in the UI only and MUST NOT be sent to the model.

### Why the model panel matters
A single LLM can hallucinate. Three independent models receiving an identical, citation-constrained prompt expose disagreements. The UI labels this as an AI-assisted reading of the record, not an endorsement.

---

## 2. Non-negotiable course requirements

| Requirement | Where it is satisfied |
| --- | --- |
| Remote database | MongoDB Atlas via `MONGODB_URI` (TLS) |
| MERN stack, no Vue/Angular/Firebase | MongoDB + Express + React (Vite) + Node |
| JSON client/server communication | REST API under `/api`, JSON only |
| AJAX-enabled web client | React SPA fetching JSON from the API |
| SwaggerHub demonstration | OpenAPI 3.0 JSON at `GET /api/openapi.json`, UI at `GET /api/docs`; importable into SwaggerHub |
| E-mail verification on signup | Token e-mail + `GET /api/auth/verify-email` |
| Password recovery | `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` |
| Unit test per endpoint | Vitest + Supertest + mongodb-memory-server in `server/tests` |
| Hosted remotely with a domain, not an IP | GCP Cloud Run + mapped domain (infra agent docs) |
| Mobile app (teammate builds later) | API is bearer-token ready and CORS-configurable; see `mobile/README.md` |
| Lighthouse 95+ desktop/mobile | Lightweight React + system fonts + accessible semantic markup |
| Extra credit: TLS everywhere | HTTPS on Cloud Run/LB + Atlas TLS + security headers |
| Extra credit: non-trivial integrations | OpenRouter multi-model AI + transactional e-mail |
| Extra credit: Docker | Multi-stage `Dockerfile` + `docker-compose.yml` |

**No DigitalOcean.** Deployment target is Google Cloud Platform (Cloud Run, Artifact Registry, Secret Manager). MongoDB Atlas is the remote DB.

---

## 3. Repository layout & file ownership

```
.
├── package.json                  # root workspaces (owned by lead)
├── README.md                     # owned by lead
├── docs/
│   ├── PROJECT_SPEC.md           # this contract (owned by lead)
│   └── ...                       # deployment/architecture docs (infra agent)
├── infra/                        # INFRA AGENT ONLY
├── Dockerfile                    # INFRA AGENT
├── cloudbuild.yaml               # INFRA AGENT
├── docker-compose.yml            # INFRA AGENT
├── .dockerignore                 # INFRA AGENT
├── .github/workflows/            # INFRA AGENT
├── server/
│   ├── package.json              # LEAD ONLY (deps already installed)
│   ├── .env.example              # LEAD
│   ├── vitest.config.js          # BACKEND AGENT
│   ├── src/
│   │   ├── index.js              # API AGENT
│   │   ├── app.js                # API AGENT
│   │   ├── config/env.js         # BACKEND AGENT
│   │   ├── db/                   # DATABASE AGENT
│   │   ├── models/               # DATABASE AGENT
│   │   ├── seed/                 # DATABASE AGENT
│   │   ├── import/               # real-data and race importer (Voteview + Congress.gov)
│   │   ├── routes/               # API AGENT
│   │   ├── controllers/          # API AGENT
│   │   ├── validators/           # API AGENT
│   │   ├── openapi/              # API AGENT
│   │   ├── services/             # BACKEND AGENT
│   │   ├── middleware/           # BACKEND AGENT
│   │   └── utils/                # BACKEND AGENT
│   └── tests/                    # BACKEND AGENT
├── client/                       # FRONTEND AGENT ONLY
├── scripts/setup.sh              # one-command local bootstrap (lead)
└── mobile/README.md              # LEAD (teammate implements later)
```

Agents must **not** edit files outside their ownership. If a dependency is missing, report it in the final message instead of editing root/server `package.json`. All required dependencies are already declared.

---

## 4. Technology choices

- Node 22.12+ (or 24+), ES modules (`"type": "module"`) everywhere in `server/`.
- Express 4, Mongoose 8, MongoDB.
- Auth: bcryptjs (12 rounds), JWT (`jsonwebtoken`), httpOnly cookie for the web app **plus** a bearer token in the response body for the future mobile app.
- Validation: Zod.
- E-mail: Nodemailer (SMTP from env; JSON/console transport fallback in development).
- AI: native `fetch` to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`).
- Client: React 18 + Vite 5 + react-router-dom 6. No component library, no icon package, no CSS framework. Hand-written CSS with design tokens.
- Tests: Vitest + Supertest + `mongodb-memory-server`.
- Deploy: Docker, Google Cloud Run, Artifact Registry, Secret Manager, Cloud Build.

---

## 5. Environment variables

`server/.env.example` (already created) is the canonical list. Key contract:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `8080` | Cloud Run sets this |
| `NODE_ENV` | `development` | |
| `MONGODB_URI` | — | Atlas URI; driver uses TLS automatically |
| `JWT_SECRET` | dev placeholder | must be set in prod |
| `JWT_EXPIRES_IN` | `7d` | |
| `CLIENT_ORIGIN` | `http://localhost:5173` | comma-separated allowed origins |
| `COOKIE_SECURE` | `false` | `true` in prod (HTTPS) |
| `OPENROUTER_API_KEY` | — | if absent, `AI_FAKE` demo mode is used |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | |
| `AI_MODEL_MINIMAX` | `minimax/minimax-m3.1-flash` | |
| `AI_MODEL_DEEPSEEK` | `deepseek/deepseek-v4.1-flash` | |
| `AI_MODEL_GROK` | `x-ai/grok-4.3` | |
| `AI_ENABLED` | `true` | `false` disables live calls |
| `AI_FAKE` | `false` | set by tests; deterministic canned analyses |
| `AI_TIMEOUT_MS` | `75000` | per model |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | — | if missing, log e-mail to console |
| `MAIL_FROM` | `Record Over Rhetoric <no-reply@recordoverrhetoric.app>` | |
| `SEED_DEMO_USER` | `true` | seed a verified demo account |
| `CONGRESS_API_KEY` | — | optional free key for official bill metadata enrichment |
| `IMPORT_CACHE_DIR` | `server/.cache` | writable cache dir for importer downloads (Docker image uses `/tmp/ror-cache`) |

---

## 6. Data model (Mongoose)

All models live in `server/src/models/`. `models/index.js` must re-export every model and default export a `models` object.

```js
// User
{
  email: String,            // required, unique, lowercase, trimmed
  passwordHash: String,     // required, select:false
  displayName: String,      // required, 2-80 chars
  isVerified: Boolean,      // default false
  verificationTokenHash: String,   // sha256 of raw token, select:false
  verificationExpiresAt: Date,
  resetTokenHash: String,          // sha256, select:false
  resetExpiresAt: Date,
  lastLoginAt: Date,
  timestamps: true,
}

// Office
{
  slug: String,             // unique, e.g. "us-senate-ga" or "real-us-senate-fl"
  name: String,             // "U.S. Senate — Georgia"
  level: String,            // 'federal' | 'state' | 'local'
  state: String,            // 2-letter or null
  district: String,         // null or e.g. "5"
  description: String,
  isSample: Boolean,        // default true; false for imported offices
  timestamps: true,
}

// Candidate
{
  slug: String,             // unique
  bioguideId: String,       // unique sparse; official Congress.gov id for real members
  name: String,
  party: String,
  office: ObjectId -> Office,   // required
  state: String,
  district: String,
  photoUrl: String,         // optional; UI falls back to initials
  officialUrl: String,      // optional; NOT sent to AI
  bio: String,              // optional; NOT sent to AI
  isSample: Boolean,        // true for seeded fictional data
  timestamps: true,
}

// Bill
{
  congress: Number,
  chamber: String,          // 'house' | 'senate'
  number: String,           // "H.R. 1234"
  title: String,
  summary: String,          // neutral, factual
  topics: [String],         // e.g. ['taxes','labor']
  introducedAt: Date,
  sponsor: String,
  sourceUrl: String,
  isSample: Boolean,
}

// Vote
{
  candidate: ObjectId -> Candidate,  // required
  bill: ObjectId -> Bill,            // required
  position: String,                  // 'yes' | 'no' | 'abstain' | 'absent'
  castAt: Date,
  note: String,
}
// unique compound index { candidate: 1, bill: 1 }

// Race
{
  slug: String,                     // unique, e.g. "ohio-us-senate-2026"
  name: String,                     // "Ohio U.S. Senate 2026"
  electionYear: Number,
  electionDate: Date,
  office: ObjectId -> Office,
  state: String,
  district: String,
  candidates: [ObjectId -> Candidate],
  missingNominees: [{ name: String, party: String, reason: String }],
  description: String,
  sourceUrl: String,
  isSample: Boolean,
  timestamps: true,
}

// Comparison
{
  user: ObjectId -> User,            // required
  candidateA: ObjectId -> Candidate,
  candidateB: ObjectId -> Candidate,
  office: ObjectId -> Office,
  race: ObjectId -> Race,           // optional; set when created from a race
  votesSnapshot: { candidateA: Number, candidateB: Number },
  models: [{
    key: String,                     // 'minimax' | 'deepseek' | 'grok'
    modelId: String,
    ok: Boolean,
    latencyMs: Number,
    analysis: Object,                // parsed structured analysis
    error: String,
  }],
  timestamps: true,
}
```

Indexes: `User.email` unique; `Office.slug` unique; `Candidate.slug` unique, `Candidate.office`; `Vote {candidate,bill}` unique; `Comparison.user + createdAt`.

### Seed data (database agent)
- 3 offices, 7 fictional candidates (2–3 per office), 12 bills across topics (taxes, labor, healthcare, immigration, energy, education, defense, civil-liberties), ~60 votes with deliberate yes/no splits and a few shared votes.
- Everything seeded is fictional and `isSample: true`. Candidate names must not match real current officeholders. Add a banner in the UI that sample data is fictional.
- Verified demo account: `demo@recordoverrhetoric.app` / `CompareVotes!2026` (only when `SEED_DEMO_USER !== 'false'`).
- `npm run seed` is idempotent (upsert by slug/number) and supports `--reset`.

### Real data import (`server/src/import/`)
- `npm run import:real -- --state=FL --limit=120 [--enrich] [--reset] [--purge-sample] [--dry-run]`
- `npm run import:races` registers all 35 races from `server/src/import/races-2026.json`. Races with a nominee who has no federal record are still created with `missingNominees` and `comparable: false`. Import all states for full coverage with four `--all-states` runs (House/Senate x 118th/119th), then `npm run import:races`.
- **Positions:** Voteview public roll-call CSVs (`H{congress}`, `S{congress}`) for per-member House/Senate votes. This is bulk data; it is used because the Congress.gov API exposes House roll calls but not individual Senate positions.
- **Bill metadata:** optional Congress.gov API v3 (`CONGRESS_API_KEY`) for official title, CRS summary, policy area, sponsor, and introduced date. Without a key, titles come from the recorded vote and topics are inferred from the bill text.
- One vote is stored per candidate/bill (the most substantive roll call: passage > resolution/concurrence > other > procedural).
- Real offices use `real-` slugs so they never collide with the fictional seed. House members are grouped by state ("all districts") so any two representatives from that state can be compared; Senate candidates are the state's two senators.
- Records created by the importer have `isSample: false`. `--reset` deletes only previously imported real records and their comparisons.
- Importer helpers (bill normalization, cast-code mapping, roll-call selection, topic inference) are unit-tested without network access.
- Per comparison, `comparisonData` caps each candidate at the 60 most recent votes to control prompt size and cost. The prompt also trims bill summaries, and OpenRouter calls use a 5,000-token output budget with low reasoning effort so long titles and reasoning fit without truncation.

---

## 7. Backend service contract (`server/src/services`)

The API layer imports exactly these names. Implement them with these signatures.

```js
// services/ai/compare.js
export const MODEL_DEFINITIONS = [
  { key: 'minimax', label: 'MiniMax M3 Flash', modelId: env.ai.models.minimax },
  { key: 'deepseek', label: 'DeepSeek 4.1 Flash', modelId: env.ai.models.deepseek },
  { key: 'grok', label: 'Grok 4.3', modelId: env.ai.models.grok },
];
export async function compareVotingRecords({ candidateA, candidateB, recordsA, recordsB })
// -> { models: [{ key, modelId, ok, latencyMs, analysis, error }], generatedAt }
// recordsA/recordsB: [{ position, castAt, note, bill: { id, number, title, summary, topics, chamber, congress } }]
// Runs the three models with Promise.allSettled. Never throws because one model failed.
// Uses a deterministic canned analysis when AI_FAKE==='true' or no API key / AI_ENABLED==='false'.

// services/ai/prompt.js
export function buildComparisonPrompt({ candidateA, candidateB, recordsA, recordsB }) // -> { system, user }
// system: nonpartisan analyst; ONLY voting records; forbid platform/rhetoric; require citations; JSON only.
// user: JSON payload of the two voting records. Must NOT contain bio/platform fields.

// services/ai/openrouter.js
export async function callOpenRouter({ modelId, system, user, timeoutMs })
// -> { ok, analysis, latencyMs, error }
// Parses JSON from message.content (tolerate ```json fences); validates shape.

// services/comparisonData.js
export async function getComparisonData(candidateAId, candidateBId)
// -> { candidateA, candidateB, recordsA, recordsB } (lean plain objects)
// Throws HttpError 400 if ids equal/invalid or candidates are not in the same office; 404 if missing.

// services/auth/tokens.js
export function signToken(user)          // -> string
export function verifyToken(token)       // -> payload | null

// services/email/mailer.js
export async function sendVerificationEmail({ to, displayName, token })  // -> { delivered: boolean, previewUrl? }
export async function sendPasswordResetEmail({ to, displayName, token }) // -> { delivered: boolean, previewUrl? }
// Verification URL: `${CLIENT_ORIGIN}/verify-email?token=...`
// Reset URL:        `${CLIENT_ORIGIN}/reset-password?token=...`
// If SMTP is unconfigured, use nodemailer jsonTransport and log a clearly marked DEV e-mail with the URL.
```

### Middleware contract
```js
// middleware/auth.js
export function requireAuth(req,res,next)   // Bearer first, then cookie 'ror_token'; sets req.user
export function optionalAuth(req,res,next)
// middleware/validate.js
export function validate(schema)            // Zod schema for req.body; 400 { error: { message, details } }
// middleware/error.js
export function notFound(req,res,next)
export function errorHandler(err,req,res,next)   // HttpError-aware; never leak stack in prod
// middleware/rateLimit.js
export const authLimiter        // 20 requests / 15 min / IP
export const compareLimiter     // 10 requests / hour / user-or-IP
// utils/httpError.js
export class HttpError extends Error { constructor(status, message, details) }
// utils/asyncHandler.js
export function asyncHandler(fn)
// utils/logger.js
export const logger = { info, warn, error }
```

### Structured AI analysis shape (validated/documented)
```json
{
  "summary": "2-4 sentence neutral summary of how the two records differ.",
  "dimensions": [
    { "topic": "Taxes", "candidateA": "...", "candidateB": "...", "difference": "..." }
  ],
  "candidateA": { "label": "Name", "strengths": ["..."], "concerns": ["..."] },
  "candidateB": { "label": "Name", "strengths": ["..."], "concerns": ["..."] },
  "sharedVotes": ["H.R. 1234 — both voted yes"],
  "notableVotes": [ { "bill": "H.R. 1234", "why": "..." } ],
  "confidence": "low|medium|high",
  "disclaimer": "AI interpretation of voting records only..."
}
```

---

## 8. REST API contract

Base path `/api`. All responses JSON. Error shape: `{ "error": { "message": string, "details"?: any } }`.

| Method | Path | Auth | Body / Query | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | — | — | `{ status:'ok', uptime, db:'connected'|'disconnected' }` |
| POST | `/api/auth/register` | — | `{ email, password, displayName }` | 201 `{ message, user }` |
| GET | `/api/auth/verify-email` | — | `?token=` | 200 `{ message, user }` |
| POST | `/api/auth/resend-verification` | — | `{ email }` | 200 `{ message }` |
| POST | `/api/auth/login` | — | `{ email, password }` | 200 `{ token, user }` + cookie |
| POST | `/api/auth/logout` | — | — | 200 `{ message }` |
| GET | `/api/auth/me` | yes | — | 200 `{ user }` |
| POST | `/api/auth/forgot-password` | — | `{ email }` | 200 generic `{ message }` |
| POST | `/api/auth/reset-password` | — | `{ token, password }` | 200 `{ message }` |
| GET | `/api/offices` | — | — | `{ offices: [...] }` |
| GET | `/api/races` | — | `?year=&state=` | `{ races: [...] }` (each race has `comparable` and `missingNominees`) |
| GET | `/api/races/:idOrSlug` | — | — | `{ race }` (includes `comparable` and `missingNominees`) |
| GET | `/api/candidates` | — | `?office=slug&search=&limit=` | `{ candidates: [...] }` |
| GET | `/api/candidates/:id` | — | — | `{ candidate: { ..., votes: [...] } }` |
| GET | `/api/candidates/:id/votes` | — | — | `{ votes: [...] }` |
| POST | `/api/comparisons` | yes | `{ candidateAId, candidateBId, raceId? }` | 201 `{ comparison }`; a race may pair candidates from different offices/chambers |
| GET | `/api/comparisons` | yes | `?page=&limit=` | `{ comparisons, pagination }` |
| GET | `/api/comparisons/:id` | yes (owner) | — | `{ comparison }` |
| GET | `/api/openapi.json` | — | — | OpenAPI 3.0 document |
| GET | `/api/docs` | — | — | Swagger UI |

Rules:
- `register` never reveals whether an e-mail exists beyond a generic message when appropriate. Unverified users cannot log in (403 with a clear message and `code: 'EMAIL_NOT_VERIFIED'`).
- Verification tokens and reset tokens are stored as SHA-256 hashes and expire (24h / 1h).
- Login sets `ror_token` cookie: `httpOnly`, `sameSite:'lax'`, `secure` in production, `maxAge` 7d. Also returns `token` for mobile.
- Password rules: min 8, max 128, at least one letter and one number.
- Candidate endpoints never expose `passwordHash` etc.; comparisons are ownership-checked.
- Every comparison record stores which model produced which result.
- Rate limits return 429 with a JSON error.

---

## 9. Frontend contract (`client/`)

React SPA, Vite. Routes:
- `/` — comparison builder (select office → pick two candidates) + hero + methodology.
- `/compare/:id` — saved comparison result.
- `/history` — user's saved comparisons (auth).
- `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`.
- `/candidates/:id` — candidate profile with vote list (public).
- `/about` — methodology, data sources, AI disclosure, disclaimer.
- 404 page.

Requirements:
- API client in `src/lib/api.js` using `fetch` with `credentials:'include'`, JSON, and an `AuthContext`.
- Handle loading / empty / error states. Never render a blank page.
- Comparison builder: office select, two accessible candidate selects, disabled compare button until two distinct candidates are chosen, inline validation.
- Results: candidate header cards (initials avatars), a **model panel with three tabs** (MiniMax / DeepSeek / Grok) showing status and per-model analysis, topic-by-topic comparison, shared votes, disclaimer. If a model failed, show a clear non-blocking error in its tab.
- Login required to run a comparison: if unauthenticated, send to `/login?next=...` and restore.
- Accessible: one `<h1>` per page, skip link, visible focus, labels for every input, `aria-live` for async statuses, color contrast ≥ 4.5:1, 44px touch targets, `prefers-reduced-motion`.
- Performance: system font stack, no external fonts/images, inline SVG, code-split routes with `React.lazy` where it does not hurt UX, no heavy dependencies. Meta description + favicon present.
- Visual direction: trustworthy civic editorial. Deep navy/ink (`#0f2742`), warm paper (`#faf7f2`), muted gold accent (`#b98a2f`), restrained borders, generous whitespace, serif display headings, clear data tables that collapse to cards on mobile.
- Include the fictional-sample-data banner when any candidate has `isSample: true`.

---

## 10. Testing contract

- `server/tests/setup.js` starts `mongodb-memory-server` once, connects Mongoose, clears collections between tests.
- `server/tests/helpers.js` builds an app with `createApp()` and creates users/candidates/offices/bills/votes.
- One or more tests for **every endpoint** in the table above, including auth failures, validation failures, ownership checks, newsletter/verification flows, and the comparison flow in `AI_FAKE=1` mode.
- Tests must not hit the network or a real database. Run with `npm test` from the repo root.

---

## 11. Deployment (infra agent)

- Multi-stage `Dockerfile`: build `client`, install `server` production deps, run as non-root, `EXPOSE 8080`, `CMD ["node","src/index.js"]`.
- Express serves `client/dist` in production with SPA fallback (API agent implements; infra documents).
- `cloudbuild.yaml`: build → push to Artifact Registry → deploy Cloud Run with Secret Manager env refs.
- Terraform (optional but preferred) for Artifact Registry + Cloud Run + domain mapping; note that domain mapping requires a verified domain and DNS records.
- `docker-compose.yml`: local MongoDB + server + client dev (documented, optional).
- `.github/workflows/ci.yml`: install, test, build client.
- Docs must cover: MongoDB Atlas TLS, GCP secret setup, Cloud Run deploy, custom domain, Lighthouse procedure, SwaggerHub import steps, and the mobile hand-off.
- Never mention or use DigitalOcean except to state it is intentionally replaced by GCP.

---

## 12. Definition of done

1. `npm install` at root succeeds.
2. `npm test` passes with every endpoint covered (currently 64 tests).
3. `npm run build` produces `client/dist` and `npm start` serves the SPA + API from one origin.
4. Seeded app works end-to-end locally with `AI_FAKE=true` (no API key) and with a real OpenRouter key.
5. No secrets committed; `.env.example` complete.
6. UI is responsive, accessible, and visually coherent; no console errors.
7. Docs let a teammate deploy to GCP and add a React Native client without touching the server.
