import 'dotenv/config';
import { sessionCookieNameFor, validateRuntimeConfig } from './validate.js';

export const env = validateRuntimeConfig(process.env);
export const sessionCookieName = sessionCookieNameFor(env.nodeEnv);
