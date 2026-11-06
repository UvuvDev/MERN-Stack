import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function zodDetails(error) {
  const issues = error.issues || [];
  return issues.map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path),
    message: issue.message,
    code: issue.code,
  }));
}

function mongooseValidationDetails(error) {
  return Object.values(error.errors || {}).map((item) => ({
    path: item.path,
    message: item.message,
  }));
}

function send(res, status, message, details) {
  const payload = { error: { message } };
  if (details !== undefined) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return send(res, err.status, err.message, err.details);
  }

  if (err && (err.name === 'ZodError' || err.constructor?.name === 'ZodError')) {
    return send(res, 400, 'Validation failed', zodDetails(err));
  }

  if (err && err.name === 'CastError') {
    return send(res, 400, `Invalid value for ${err.path || 'field'}`, {
      path: err.path,
      value: err.value,
    });
  }

  if (err && err.name === 'ValidationError') {
    return send(res, 400, 'Validation failed', mongooseValidationDetails(err));
  }

  if (err && (err.code === 11000 || err.code === '11000')) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : undefined;
    return send(
      res,
      409,
      field
        ? `A record with that ${field} already exists`
        : 'A record with that value already exists',
      err.keyValue,
    );
  }

  if (err && (err.type === 'entity.parse.failed' || err.status === 400)) {
    return send(res, 400, 'Invalid request body');
  }

  const status =
    Number.isInteger(err?.status) && err.status >= 400 && err.status < 600
      ? err.status
      : 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} failed:`, err);
  }

  const message =
    status >= 500 && (env.isProd || env.isTest)
      ? 'Internal server error'
      : err?.message || 'Internal server error';

  return send(res, status, message);
}

export default errorHandler;
