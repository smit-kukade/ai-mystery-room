import { Router, type Request } from 'express';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyCsrf, verifyOrigin } from '../middleware/csrf.js';
import { env, sessionCookieName } from '../config/env.js';

export const auth = Router();
const registrationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) });
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const dummyPasswordHash = argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
const publicUser = (user: { _id: unknown; name: string; email: string }) => ({ id: String(user._id), name: user.name, email: user.email });
function rotateSession(req: Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => req.session.regenerate(error => {
    if (error) return reject(error);
    req.session.userId = userId;
    req.session.csrfToken = randomBytes(32).toString('base64url');
    req.session.save(saveError => saveError ? reject(saveError) : resolve());
  }));
}

auth.get('/me', async (req, res, next) => {
  try {
    if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('base64url');
    if (!req.session.userId) return res.json({ user: null, csrfToken: req.session.csrfToken });
    const user = await UserModel.findById(req.session.userId).select('_id name email').lean();
    if (!user) { req.session.destroy(() => undefined); return res.json({ user: null, csrfToken: req.session.csrfToken }); }
    res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  } catch (error) { next(error); }
});

auth.post('/register', registerLimit, verifyOrigin, verifyCsrf, async (req, res, next) => {
  try {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_REGISTRATION', 'Enter a name, valid email, and password of at least 12 characters.');
    const { name, email, password } = parsed.data;
    if (await UserModel.exists({ email })) throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await UserModel.create({ name, email, passwordHash });
    await rotateSession(req, String(user._id));
    res.status(201).json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  } catch (error: any) {
    if (error?.code === 11000) return next(new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.'));
    next(error);
  }
});

auth.post('/login', loginLimit, verifyOrigin, verifyCsrf, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const user = await UserModel.findOne({ email: parsed.data.email }).select('+passwordHash name email');
    const hash = user?.passwordHash ?? await dummyPasswordHash;
    const valid = await argon2.verify(hash, parsed.data.password).catch(() => false);
    if (!user || !valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    await rotateSession(req, String(user._id));
    res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  } catch (error) { next(error); }
});

auth.post('/logout', verifyOrigin, verifyCsrf, requireAuth, (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie(sessionCookieName, { path: '/', sameSite: 'lax', secure: env.nodeEnv === 'production' });
    res.status(204).end();
  });
});
