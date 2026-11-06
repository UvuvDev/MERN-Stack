#!/usr/bin/env bash
#
# Record Over Rhetoric — local setup
#
# Installs dependencies, creates server/.env, starts a local MongoDB (Docker),
# seeds the demo data, and optionally imports real congressional records.
#
# Usage:
#   ./scripts/setup.sh
#   ./scripts/setup.sh --real --state=FL
#   ./scripts/setup.sh --start
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/server/.env"
ENV_EXAMPLE="$ROOT_DIR/server/.env.example"
MONGO_CONTAINER="ror-mongo"
DEFAULT_MONGO_URI="mongodb://127.0.0.1:27017/record_over_rhetoric"

USE_DOCKER=1
DO_SEED=1
DO_REAL=0
REAL_ONLY=0
ENRICH=0
RESET=0
START=0
STATE="FL"
LIMIT="120"
MONGO_URI_OVERRIDE="${MONGODB_URI:-}"

usage() {
  cat <<'EOF'
Record Over Rhetoric — setup script

Usage:
  ./scripts/setup.sh [options]

Options:
  --atlas=URI        Use a MongoDB Atlas connection string instead of local Docker
  --no-docker        Do not start/manage MongoDB with Docker
  --skip-seed        Skip seeding sample data
  --reset            Wipe the database before seeding
  --real             Import real records, register known races, and load priority measures
  --real-only        Import real records and remove the fictional sample data
  --enrich           Add official bill metadata from Congress.gov (needs key)
  --state=FL         State(s) for --real (default: FL)
  --limit=120        Roll calls per chamber for --real (0 = all)
  --start            Run `npm run dev` when setup is finished
  -h, --help         Show this help

Environment:
  MONGODB_URI        Same as --atlas
  OPENROUTER_API_KEY If set, written to server/.env and live AI is enabled
  CONGRESS_API_KEY   Optional key for official bill metadata (--real --enrich)

Examples:
  ./scripts/setup.sh
  ./scripts/setup.sh --start
  ./scripts/setup.sh --real --state=FL --limit=80
  ./scripts/setup.sh --real-only --state=FL
  CONGRESS_API_KEY=... ./scripts/setup.sh --real --state=FL --enrich
  MONGODB_URI="mongodb+srv://..." ./scripts/setup.sh
EOF
}

for argument in "$@"; do
  case "$argument" in
    -h|--help) usage; exit 0 ;;
    --no-docker) USE_DOCKER=0 ;;
    --skip-seed) DO_SEED=0 ;;
    --real) DO_REAL=1 ;;
    --real-only) DO_REAL=1; REAL_ONLY=1 ;;
    --enrich) ENRICH=1 ;;
    --reset) RESET=1 ;;
    --start) START=1 ;;
    --state=*) STATE="${argument#*=}" ;;
    --limit=*) LIMIT="${argument#*=}" ;;
    --atlas=*) MONGO_URI_OVERRIDE="${argument#*=}" ;;
    *)
      echo "Unknown option: $argument" >&2
      echo >&2
      usage >&2
      exit 1
      ;;
  esac
done

say() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

get_env() {
  awk -v key="$2" 'BEGIN { FS = "=" } $1 == key { sub(/^[^=]*=/, ""); print; exit }' "$1"
}

# Update KEY=value in an env file without clobbering comments or other keys.
set_env() {
  node -e '
    const fs = require("fs");
    const [file, key, value] = process.argv.slice(1);
    let text = fs.readFileSync(file, "utf8");
    const pattern = new RegExp(
      "^" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=.*$",
      "m"
    );
    if (pattern.test(text)) {
      text = text.replace(pattern, key + "=" + value);
    } else {
      text = text.trimEnd() + "\n" + key + "=" + value + "\n";
    }
    fs.writeFileSync(file, text);
  ' "$1" "$2" "$3"
}

port_is_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/27017") >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || die "Node.js is required. Install Node 20+ and retry."
command -v npm >/dev/null 2>&1 || die "npm is required. Install Node 20+ and retry."

NODE_VERSION="$(node -p 'process.versions.node')"
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 22 && minor >= 12) || major >= 24 ? 0 : 1)'; then
  die "Node $NODE_VERSION found, but Node 22.12+ (or 24+) is required."
fi

say "==> Installing dependencies"
npm install --no-audit --no-fund

# ---------------------------------------------------------------------------
# 2. Environment file
# ---------------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  say "==> Created server/.env from server/.env.example"
else
  say "==> Keeping existing server/.env"
fi

CURRENT_JWT="$(get_env "$ENV_FILE" JWT_SECRET || true)"
if [ -z "$CURRENT_JWT" ] || [ "$CURRENT_JWT" = "replace-with-a-long-random-string" ]; then
  set_env "$ENV_FILE" JWT_SECRET "$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  say "==> Generated a JWT secret"
fi

CURRENT_OPENROUTER_KEY="$(get_env "$ENV_FILE" OPENROUTER_API_KEY || true)"
if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  set_env "$ENV_FILE" OPENROUTER_API_KEY "$OPENROUTER_API_KEY"
  CURRENT_OPENROUTER_KEY="$OPENROUTER_API_KEY"
fi
if [ -n "$CURRENT_OPENROUTER_KEY" ]; then
  set_env "$ENV_FILE" AI_FAKE false
  say "==> OpenRouter key detected: live AI enabled"
else
  set_env "$ENV_FILE" AI_FAKE true
  say "==> No OPENROUTER_API_KEY: using deterministic demo AI (AI_FAKE=true)"
fi

if [ -n "${CONGRESS_API_KEY:-}" ]; then
  set_env "$ENV_FILE" CONGRESS_API_KEY "$CONGRESS_API_KEY"
  say "==> Congress.gov API key saved for real-data enrichment"
fi

# ---------------------------------------------------------------------------
# 3. MongoDB
# ---------------------------------------------------------------------------
EXISTING_URI="$(get_env "$ENV_FILE" MONGODB_URI || true)"
MONGO_URI="$MONGO_URI_OVERRIDE"

if [ -z "$MONGO_URI" ]; then
  case "$EXISTING_URI" in
    ""|*"USER:PASSWORD"*|*"cluster0.example"*) MONGO_URI="" ;;
    *) MONGO_URI="$EXISTING_URI" ;;
  esac
fi

if [ -n "$MONGO_URI" ]; then
  say "==> Using MongoDB from MONGODB_URI / --atlas"
else
  if [ "$USE_DOCKER" = 1 ]; then
    command -v docker >/dev/null 2>&1 || die "Docker is not installed. Set MONGODB_URI to a MongoDB/Atlas instance, or install Docker."
    docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker, or set MONGODB_URI."

    if docker ps -a --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
      if ! docker ps --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
        say "==> Starting existing MongoDB container ($MONGO_CONTAINER)"
        docker start "$MONGO_CONTAINER" >/dev/null
      else
        say "==> MongoDB container ($MONGO_CONTAINER) is already running"
      fi
    elif port_is_open; then
      say "==> Using the MongoDB already listening on 127.0.0.1:27017"
    else
      say "==> Starting MongoDB in Docker ($MONGO_CONTAINER)"
      docker run -d --name "$MONGO_CONTAINER" -p 127.0.0.1:27017:27017 mongo:7 >/dev/null
    fi

    say "==> Waiting for MongoDB"
    MONGO_READY=0
    for _ in $(seq 1 40); do
      if docker ps --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
        if docker exec "$MONGO_CONTAINER" mongosh --quiet --eval 'db.adminCommand({ ping: 1 }).ok' 2>/dev/null | grep -q 1; then
          MONGO_READY=1
          break
        fi
      elif port_is_open; then
        MONGO_READY=1
        break
      fi
      sleep 1
    done
    [ "$MONGO_READY" = 1 ] || die "MongoDB did not become ready. Check 'docker logs $MONGO_CONTAINER'."
    MONGO_URI="$DEFAULT_MONGO_URI"
  else
    die "No MongoDB available. Set MONGODB_URI, or run without --no-docker."
  fi
fi

set_env "$ENV_FILE" MONGODB_URI "$MONGO_URI"
export MONGODB_URI="$MONGO_URI"
say "==> MongoDB: $MONGO_URI"

# ---------------------------------------------------------------------------
# 4. Seed and optional real-data import
# ---------------------------------------------------------------------------
if [ "$DO_SEED" = 1 ]; then
  if [ "$RESET" = 1 ]; then
    say "==> Seeding sample data (reset)"
    npm run seed -- --reset
  else
    say "==> Seeding sample data"
    npm run seed
  fi
fi

if [ "$DO_REAL" = 1 ]; then
  say "==> Importing real congressional records for $STATE (limit $LIMIT per chamber)"
  IMPORT_ARGS=(--state="$STATE" --limit="$LIMIT")
  if [ "$REAL_ONLY" = 1 ]; then
    IMPORT_ARGS+=(--purge-sample)
  fi
  if [ "$ENRICH" = 1 ]; then
    IMPORT_ARGS+=(--enrich)
  fi
  npm run import:real -- "${IMPORT_ARGS[@]}"

  say "==> Registering known races"
  npm run import:races || true
  say "==> Loading priority measures"
  npm run import:priority || true

fi

# ---------------------------------------------------------------------------
# 5. Next steps
# ---------------------------------------------------------------------------
cat <<EOF

Setup complete.

  API:      http://localhost:8080/api
  Swagger:  http://localhost:8080/api/docs
  Web app:  http://localhost:5173
  Demo:     demo@recordoverrhetoric.app / CompareVotes!2026

Start the app with:
  npm run dev

EOF

if [ "$START" = 1 ]; then
  say "==> Starting the API and web client (Ctrl+C to stop)"
  exec npm run dev
fi
