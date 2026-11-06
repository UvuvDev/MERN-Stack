import { HttpError } from '../utils/httpError.js';

function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export function validate(schema) {
  return function validateBody(req, res, next) {
    if (!schema || typeof schema.safeParse !== 'function') {
      return next(new Error('validate() requires a Zod schema'));
    }

    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(
        new HttpError(400, 'Validation failed', formatZodIssues(result.error)),
      );
    }

    req.body = result.data;
    return next();
  };
}

export default validate;
