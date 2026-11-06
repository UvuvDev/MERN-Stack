# Mobile client (hand-off)

The mobile app is intentionally **not implemented** in this repository. The API is designed so a teammate can add a React Native (Expo) client without changing the server.

## What is already ready

- **Token auth for native clients.** `POST /api/auth/login` returns `{ token, user }` in the JSON body (the web app uses the httpOnly cookie instead). Send it as `Authorization: Bearer <token>` on every request.
- **No CSRF requirements.** Bearer requests are not cookie-based and need no CSRF token.
- **CORS allow-list.** Set `CLIENT_ORIGIN` to a comma-separated list that includes your Expo origin / web preview. Requests with no `Origin` header (native fetch) are allowed.
- **Stable JSON contract.** See `docs/PROJECT_SPEC.md` §8 and the live OpenAPI document at `GET /api/openapi.json`.
- **Identical comparison results.** `POST /api/comparisons` and `GET /api/comparisons` return the same structured model analyses the web UI renders. The three models are keyed `minimax`, `deepseek`, `grok`.

## Suggested stack (to match the web)

- Expo + React Native + React Navigation.
- `fetch` wrapper in `mobile/src/lib/api.js`, base URL from `expo-constants` extra.
- Store the JWT with `expo-secure-store`; attach it as a bearer token.
- Reuse the same screen flow: office picker → two candidate pickers → comparison → saved history.
- Deep links for `/verify-email?token=...` and `/reset-password?token=...` (the e-mails use `CLIENT_ORIGIN`; set it to your web origin and have the mobile app accept the token via a universal link or manual paste).

## API base URLs

- Local dev (Android emulator): `http://10.0.2.2:8080/api`
- Local dev (iOS simulator): `http://localhost:8080/api`
- Production: `https://<your-domain>/api`
