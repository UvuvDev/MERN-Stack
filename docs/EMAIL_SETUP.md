# Email and account creation

Account creation, e-mail verification, resend verification, forgotten-password, and password reset are already implemented. The only missing piece for real e-mail is SMTP configuration.

## How the flow works

1. `POST /api/auth/register` creates an unverified user and stores a SHA-256 hash of a 24-hour verification token.
2. The server sends a link to `CLIENT_ORIGIN + /verify-email?token=...`.
3. The user opens the link; `GET /api/auth/verify-email` marks the account verified.
4. Unverified users cannot log in (`403`, code `EMAIL_NOT_VERIFIED`).
5. Forgot-password stores a 1-hour token and sends `CLIENT_ORIGIN + /reset-password?token=...`.

If `SMTP_HOST` is blank, the server prints the link to the console as a `DEV EMAIL` block. Registration still succeeds.

---

## Local development: Mailpit (recommended)

Mailpit runs a local SMTP server and a web inbox. No real e-mail leaves your machine.

```bash
docker run -d --name ror-mailpit \
  -p 127.0.0.1:1025:1025 \
  -p 127.0.0.1:8025:8025 \
  axllent/mailpit
```

Set these in `server/.env`:

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
MAIL_FROM=Record Over Rhetoric <no-reply@recordoverrhetoric.app>
CLIENT_ORIGIN=http://localhost:5173
```

Restart the server (`npm run dev`), register at `/register`, then open **http://localhost:8025**. The message appears in Mailpit; click the verification link.

If the API runs inside Docker Compose, use `SMTP_HOST=mailpit` instead of `127.0.0.1`.

Test SMTP without creating an account:

```bash
npm run email:test -- --to=test@example.com
```

---

## Real inbox: Gmail (quickest for a class demo)

Gmail requires two-factor authentication and an **App Password**; your normal Google password will not work.

1. Enable 2-Step Verification on the Google account.
2. Google Account → Security → App passwords → create one for “Mail”.
3. Configure `server/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.account@gmail.com
SMTP_PASS=the-16-character-app-password
MAIL_FROM=Record Over Rhetoric <your.account@gmail.com>
CLIENT_ORIGIN=http://localhost:5173
```

Gmail rewrites the From address to the authenticated account, so keep `MAIL_FROM` on that Gmail address. Free Gmail sends roughly 500 messages/day and is not suitable for a production app.

### Gmail in production and compromise recovery

Yes, Gmail SMTP can be used in deployment. For a public app it is the weakest option because an App Password is a **mailbox credential**, not a send-only API key:

- It can send mail as the account and, if IMAP is enabled, read mailbox contents.
- It cannot normally change the Google password, 2FA, or account recovery settings.
- It is **revocable**, but not retroactive: you can stop future access, not unsend messages or unread data.

Use a **dedicated Google account** with no personal mail, 2FA enabled, and a dedicated App Password if you use Gmail for a class deployment. Never use your personal account.

If the password is stolen or the server is compromised:

1. Google Account → Security → App passwords → revoke that App Password.
2. Change the Google account password and sign out of all sessions.
3. Review Security Activity, sent mail, filters, forwarding, delegation, and IMAP/POP settings.
4. If the website host was compromised, treat **all** environment secrets as exposed: rotate the JWT secret, MongoDB password, OpenRouter key, Congress key, and any other SMTP/provider keys.
5. Check provider logs for abuse and add rate limits/monitoring.

A transactional provider (Resend/Mailgun/SendGrid/SES) is safer for production: use a sending-only API key scoped to a verified domain, rotate it independently, and keep it in Secret Manager. A stolen provider key can still send spam from your domain until revoked, but it does not expose a personal mailbox.

---

## Production: transactional provider

Use a provider with a verified sending domain: **Resend**, Mailgun, SendGrid, Brevo, or Amazon SES. Example values:

| Provider | SMTP host | Port | SMTP user | SMTP password |
| --- | --- | --- | --- | --- |
| Resend | `smtp.resend.com` | `587` | `resend` | API key |
| Mailgun | `smtp.mailgun.org` | `587` | postmaster address | SMTP password |
| SendGrid | `smtp.sendgrid.net` | `587` | `apikey` | API key |
| Brevo | `smtp-relay.brevo.com` | `587` | account login | SMTP key |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | `587` | SMTP username | SMTP password |

Then:

1. Verify the domain and add the provider’s SPF/DKIM DNS records.
2. Set `MAIL_FROM` to an address on that domain.
3. Store the values in GCP Secret Manager (`smtp-host`, `smtp-port`, `smtp-user`, `smtp-pass`, `mail-from`); the Cloud Build and Terraform configs already reference them.
4. Set `CLIENT_ORIGIN=https://your.domain` so verification/reset links point at the deployed HTTPS site.
5. Redeploy the Cloud Run service.

Never commit SMTP credentials, app passwords, or API keys. `server/.env` is git-ignored; production values belong in Secret Manager.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `535 Authentication failed` | Use a Gmail App Password, not the account password; or the provider API key/SMTP password. |
| Connection timeout | Port `587` uses STARTTLS; port `465` uses implicit TLS. The server selects TLS automatically for 465. |
| Verification link points to localhost | Set `CLIENT_ORIGIN` to the deployed domain. |
| E-mail lands in spam | Verify the sending domain and SPF/DKIM; use a real domain sender. |
| Gmail stops after a while | Free Gmail daily limits; move to a transactional provider. |
| Env changes ignored | The mail transport is created once; restart the server. |

---

## Useful commands

```bash
# Send a test message using the current server/.env SMTP settings
npm run email:test -- --to=you@example.com

# Remove the local Mailpit container
docker rm -f ror-mailpit
```
