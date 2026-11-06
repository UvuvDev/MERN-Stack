export class HttpError extends Error {
  constructor(status, message, details) {
    super(message || 'Request failed');
    this.name = 'HttpError';
    this.status = status;
    this.statusCode = status;
    if (details !== undefined) {
      this.details = details;
    }
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}

export default HttpError;
