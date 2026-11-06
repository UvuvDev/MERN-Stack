import { z } from 'zod';

const email = z
  .string({ required_error: 'E-mail is required.' })
  .trim()
  .toLowerCase()
  .email('Enter a valid e-mail address.')
  .max(254, 'E-mail is too long.');

const password = z
  .string({ required_error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const displayName = z
  .string({ required_error: 'Display name is required.' })
  .trim()
  .min(2, 'Display name must be at least 2 characters.')
  .max(80, 'Display name must be at most 80 characters.');

export const registerSchema = z.object({
  email,
  password,
  displayName,
});

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
});

export const resendVerificationSchema = z.object({
  email,
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Reset token is required.' })
    .trim()
    .min(1, 'Reset token is required.'),
  password,
});

export const verifyEmailQuerySchema = z.object({
  token: z
    .string({ required_error: 'Verification token is required.' })
    .trim()
    .min(1, 'Verification token is required.'),
});

export default {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailQuerySchema,
};
