import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from './errors.js';

export const verifyOrigin: RequestHandler = (req, _res, next) => {
  const source = req.get('origin') ?? req.get('referer');
  let valid = false;
  try { valid = Boolean(source && new URL(source).origin === env.clientOrigin); } catch { valid = false; }
  if (!valid) return next(new HttpError(403, 'INVALID_ORIGIN', 'Request origin is not allowed.'));
  next();
};

export const verifyCsrf: RequestHandler = (req, _res, next) => {
  const expected = req.session.csrfToken;
  const supplied = req.get('x-csrf-token');
  if (!expected || !supplied) return next(new HttpError(403, 'CSRF_INVALID', 'Refresh the page and try again.'));
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return next(new HttpError(403, 'CSRF_INVALID', 'Refresh the page and try again.'));
  next();
};
