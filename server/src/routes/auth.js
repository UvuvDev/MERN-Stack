import { Router } from 'express';
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.js';
import {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.get('/verify-email', verifyEmail);
router.post(
  '/resend-verification',
  authLimiter,
  validate(resendVerificationSchema),
  resendVerification,
);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);

export default router;
