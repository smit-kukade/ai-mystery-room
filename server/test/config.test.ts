import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sessionCookieNameFor, validateRuntimeConfig } from '../src/config/validate.js';

const validSecret = () => randomBytes(48).toString('base64url');
const config = (overrides: Record<string, string | undefined> = {}) => validateRuntimeConfig({
  NODE_ENV: 'development',
  CLIENT_ORIGIN: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/config-validation-tests',
  SESSION_SECRET: validSecret(),
  ...overrides,
});

test('requires an explicit supported NODE_ENV', () => {
  assert.throws(() => config({ NODE_ENV: undefined }), /NODE_ENV is required/);
  assert.throws(() => config({ NODE_ENV: 'staging' }), /NODE_ENV is required/);
  assert.equal(config({ NODE_ENV: 'development' }).nodeEnv, 'development');
  assert.equal(config({ NODE_ENV: 'test' }).nodeEnv, 'test');
});

test('rejects malformed CLIENT_ORIGIN values and normalizes valid origins', () => {
  assert.throws(() => config({ CLIENT_ORIGIN: undefined }), /CLIENT_ORIGIN is required/);
  for (const clientOrigin of ['not-a-url', 'https://origin.example/cases', 'https://origin.example/?tab=1', 'https://origin.example/#fragment', 'https://user:pass@origin.example']) {
    assert.throws(() => config({ NODE_ENV: 'production', CLIENT_ORIGIN: clientOrigin }), /CLIENT_ORIGIN/);
  }
  assert.equal(config({ NODE_ENV: 'development', CLIENT_ORIGIN: 'http://origin.example' }).clientOrigin, 'http://origin.example');
  assert.throws(() => config({ NODE_ENV: 'production', CLIENT_ORIGIN: 'http://origin.example' }), /HTTPS in production/);
  assert.equal(config({ NODE_ENV: 'production', CLIENT_ORIGIN: 'https://origin.example:443/' }).clientOrigin, 'https://origin.example');
});

test('requires a sufficiently long SESSION_SECRET and rejects obvious defaults', () => {
  assert.throws(() => config({ SESSION_SECRET: undefined }), /SESSION_SECRET is required/);
  assert.throws(() => config({ SESSION_SECRET: 'short-secret' }), /at least 32 bytes/);
  assert.throws(() => config({ SESSION_SECRET: 'a'.repeat(48) }), /insecure placeholder/);
  assert.throws(() => config({ SESSION_SECRET: '0123456789'.repeat(4) }), /insecure placeholder/);
  assert.throws(() => config({ SESSION_SECRET: 'replace-with-at-least-32-random-bytes' }), /insecure placeholder/);
  assert.equal(config({ SESSION_SECRET: validSecret() }).nodeEnv, 'development');
});

test('accepts a valid production configuration and returns one canonical origin', () => {
  const production = config({
    NODE_ENV: 'production',
    CLIENT_ORIGIN: 'https://mystery-room.onrender.com/',
    SESSION_SECRET: validSecret(),
  });
  assert.equal(production.nodeEnv, 'production');
  assert.equal(production.clientOrigin, 'https://mystery-room.onrender.com');
});

test('uses one cookie name mapping for normalized development and production modes', () => {
  assert.equal(sessionCookieNameFor('development'), 'amr.sid');
  assert.equal(sessionCookieNameFor('test'), 'amr.sid');
  assert.equal(sessionCookieNameFor('production'), '__Host-amr.sid');
});
