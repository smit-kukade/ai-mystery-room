import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';

declare module 'express-session' {
  interface SessionData { userId?: string; csrfToken?: string }
}

declare global {
  namespace Express { interface Request { userId?: string } }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) return next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.'));
  req.userId = req.session.userId;
  next();
};
