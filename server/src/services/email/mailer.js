import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let transport = null;

function hasSmtp() {
  return Boolean(env.mail.host);
}

function getTransport() {
  if (transport) return transport;
  if (hasSmtp()) {
    transport = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.port === 465,
      auth: env.mail.user
        ? { user: env.mail.user, pass: env.mail.pass }
        : undefined,
    });
  } else {
    transport = nodemailer.createTransport({ jsonTransport: true });
  }
  return transport;
}

function clientBaseUrl() {
  return (env.clientOrigins[0] || 'http://localhost:5173').replace(/\/+$/, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function devLog({ to, subject, url }) {
  console.log('\n================= DEV EMAIL =================');
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`URL:     ${url}`);
  console.log('=============================================\n');
}

async function send({ to, subject, text, html, url }) {
  if (!to) {
    return { delivered: false };
  }

  if (!hasSmtp()) {
    devLog({ to, subject, url });
  }

  try {
    const info = await getTransport().sendMail({
      from: env.mail.from,
      to,
      subject,
      text,
      html,
    });
    const rejected = Array.isArray(info.rejected) ? info.rejected.length : 0;
    return { delivered: rejected === 0, previewUrl: url };
  } catch (error) {
    logger.error('Failed to send e-mail:', error);
    return { delivered: false, previewUrl: url };
  }
}

export async function sendVerificationEmail({ to, displayName, token }) {
  const url = `${clientBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(displayName || 'there');
  const subject = 'Verify your Record Over Rhetoric account';
  const text = [
    `Hello ${displayName || 'there'},`,
    '',
    'Confirm your e-mail address to start comparing voting records:',
    url,
    '',
    'This link expires in 24 hours. If you did not create an account, you can ignore this message.',
    '',
    '— Record Over Rhetoric',
  ].join('\n');
  const html = [
    `<p>Hello ${safeName},</p>`,
    '<p>Confirm your e-mail address to start comparing voting records:</p>',
    `<p><a href="${escapeHtml(url)}">Verify my e-mail</a></p>`,
    '<p>This link expires in 24 hours. If you did not create an account, you can ignore this message.</p>',
    '<p>— Record Over Rhetoric</p>',
  ].join('\n');

  return send({ to, subject, text, html, url });
}

export async function sendPasswordResetEmail({ to, displayName, token }) {
  const url = `${clientBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(displayName || 'there');
  const subject = 'Reset your Record Over Rhetoric password';
  const text = [
    `Hello ${displayName || 'there'},`,
    '',
    'Use the link below to choose a new password:',
    url,
    '',
    'This link expires in 1 hour. If you did not request a reset, you can ignore this message.',
    '',
    '— Record Over Rhetoric',
  ].join('\n');
  const html = [
    `<p>Hello ${safeName},</p>`,
    '<p>Use the link below to choose a new password:</p>',
    `<p><a href="${escapeHtml(url)}">Reset my password</a></p>`,
    '<p>This link expires in 1 hour. If you did not request a reset, you can ignore this message.</p>',
    '<p>— Record Over Rhetoric</p>',
  ].join('\n');

  return send({ to, subject, text, html, url });
}

export default { sendVerificationEmail, sendPasswordResetEmail };
