#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const envPath of [path.join(root, 'server/.env'), path.join(root, '.env')]) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const args = process.argv.slice(2);
const toArg = args.find((value) => value.startsWith('--to='));
const to = toArg ? toArg.slice('--to='.length) : process.env.TEST_EMAIL_TO;

if (!to) {
  console.error('Usage: npm run email:test -- --to=you@example.com');
  process.exit(1);
}

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const from =
  process.env.MAIL_FROM ||
  'Record Over Rhetoric <no-reply@recordoverrhetoric.app>';

if (!host) {
  console.error(
    'SMTP_HOST is not set. Configure SMTP in server/.env (see docs/EMAIL_SETUP.md).'
  );
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: user ? { user, pass } : undefined,
});

try {
  const info = await transport.sendMail({
    from,
    to,
    subject: 'Record Over Rhetoric SMTP test',
    text: 'Your SMTP configuration is working. Account verification and password reset e-mails can now be delivered.',
    html: '<p>Your SMTP configuration is working.</p><p>Account verification and password reset e-mails can now be delivered.</p>',
  });
  console.log(`Sent to ${to}`);
  console.log(`SMTP: ${host}:${port}`);
  console.log(`From: ${from}`);
  console.log(`Message id: ${info.messageId || '(not provided)'}`);
  if (Array.isArray(info.rejected) && info.rejected.length > 0) {
    console.log(`Rejected: ${info.rejected.join(', ')}`);
  }
} catch (error) {
  console.error(`SMTP test failed: ${error.message}`);
  process.exitCode = 1;
}
