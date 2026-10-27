export type NodeEnvironment = 'development' | 'test' | 'production';

export function sessionCookieNameFor(nodeEnv: NodeEnvironment): string {
  return nodeEnv === 'production' ? '__Host-amr.sid' : 'amr.sid';
}

export interface RuntimeConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  clientOrigin: string;
  mongoUri: string;
  sessionSecret: string;
  geminiKey: string;
  geminiModel: string;
  geminiTimeout: number;
  limitWindow: number;
  limitMax: number;
}

const allowedNodeEnvironments = new Set<NodeEnvironment>(['development', 'test', 'production']);
const obviousSessionSecrets = new Set([
  'secret', 'password', 'password123', 'changeme', 'change-me', 'change_me', 'changeit',
  'your-secret', 'your-session-secret', 'development-secret', 'dev-secret', 'test-secret',
  'replace-with-at-least-32-random-bytes', 'keyboard cat', 'keyboard-cat',
]);

function validateSessionSecret(value: string | undefined): string {
  if (!value) throw new Error('SESSION_SECRET is required. Generate a unique random value for this environment.');
  if (Buffer.byteLength(value, 'utf8') < 32) throw new Error('SESSION_SECRET must be at least 32 bytes.');
  const normalized = value.trim().toLowerCase();
  const characters = Array.from(value);
  const repeatedPattern = characters.length >= 32 && Array.from({ length: Math.min(16, Math.floor(characters.length / 2)) }, (_, index) => index + 1)
    .some(period => characters.every((character, index) => character === characters[index % period]));
  const placeholder = obviousSessionSecrets.has(normalized)
    || repeatedPattern
    || /^(?:<[^>]+>|\$\{[^}]+\})$/u.test(value)
    || /^(?:replace|change|your|insert|placeholder|example)[-_ ].*$/u.test(normalized)
    || /^(?:development|dev|test)[-_ ]+(?:session[-_ ]+)?secret(?:[-_ ].*)?$/u.test(normalized);
  if (placeholder) throw new Error('SESSION_SECRET uses an insecure placeholder or development default. Generate a unique random value.');
  return value;
}

function validateClientOrigin(value: string | undefined, nodeEnv: NodeEnvironment): string {
  if (!value?.trim()) throw new Error('CLIENT_ORIGIN is required and must be an origin such as https://your-service.onrender.com.');
  let parsed: URL;
  try { parsed = new URL(value.trim()); }
  catch { throw new Error('CLIENT_ORIGIN must be a valid URL origin.'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('CLIENT_ORIGIN must use HTTP or HTTPS.');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.href !== `${parsed.origin}/`) {
    throw new Error('CLIENT_ORIGIN must contain only the origin: scheme, host, and optional port; no credentials, path, query, or fragment.');
  }
  if (nodeEnv === 'production' && parsed.protocol !== 'https:') throw new Error('CLIENT_ORIGIN must use HTTPS in production.');
  return parsed.origin;
}

export function validateRuntimeConfig(source: NodeJS.ProcessEnv | Record<string, string | undefined>): RuntimeConfig {
  const rawNodeEnv = source.NODE_ENV?.trim();
  if (!rawNodeEnv || !allowedNodeEnvironments.has(rawNodeEnv as NodeEnvironment)) {
    throw new Error('NODE_ENV is required and must be development, test, or production.');
  }
  const nodeEnv = rawNodeEnv as NodeEnvironment;
  const sessionSecret = validateSessionSecret(source.SESSION_SECRET);
  const clientOrigin = validateClientOrigin(source.CLIENT_ORIGIN, nodeEnv);
  const mongoUri = source.MONGODB_URI?.trim();
  if (!mongoUri) throw new Error('MONGODB_URI is required.');
  return {
    nodeEnv,
    port: Number(source.PORT ?? 4000),
    clientOrigin,
    mongoUri,
    sessionSecret,
    geminiKey: source.GEMINI_API_KEY ?? '',
    geminiModel: source.GEMINI_MODEL ?? 'gemini-3.8-flash',
    geminiTimeout: Number(source.GEMINI_TIMEOUT_MS ?? 45000),
    limitWindow: Number(source.RATE_LIMIT_WINDOW_MS ?? 900000),
    limitMax: Number(source.RATE_LIMIT_MAX ?? 20),
  };
}
