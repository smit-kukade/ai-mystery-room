import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { resolve } from 'node:path';

const origin = 'http://localhost:5173';
let mongo: MongoMemoryServer;
let app: typeof import('../src/app.js').app;
let store: typeof import('../src/app.js').sessionStore;
let UserModel: typeof import('../src/models/User.js').UserModel;
let CaseModel: typeof import('../src/models/Case.js').CaseModel;
let csrfA = '';
let csrfB = '';
let userA = '';
let userB = '';
let caseId = '';
let solvedCaseId = '';

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DOTENV_CONFIG_PATH = resolve('..', 'server', '.env.example');
  process.env.CLIENT_ORIGIN = origin;
  process.env.SESSION_SECRET = randomBytes(48).toString('base64url');
  process.env.RATE_LIMIT_MAX = '100';
  process.env.MONGOMS_DOWNLOAD_DIR = resolve('..', 'server', '.test-cache', 'mongodb-binaries');
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mystery_auth_tests';
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('mystery_auth_tests');
  const modules = await Promise.all([import('../src/app.js'), import('../src/models/User.js'), import('../src/models/Case.js')]);
  app = modules[0].app;
  store = modules[0].sessionStore;
  UserModel = modules[1].UserModel;
  CaseModel = modules[2].CaseModel;
  await mongoose.connect(process.env.MONGODB_URI);
});

after(async () => {
  await mongoose.disconnect();
  if (store) await store.close();
  if (mongo) await mongo.stop();
});

function agent() { return request.agent(app); }
function withSecurity(req: request.Test, token: string) { return req.set('Origin', origin).set('X-CSRF-Token', token); }
async function createAccount(email: string, name: string) {
  const client = agent();
  const initial = await client.get('/api/v1/auth/me');
  const csrf = initial.body.csrfToken as string;
  const response = await withSecurity(client.post('/api/v1/auth/register').send({ name, email, password: 'a-long-test-password-42' }), csrf);
  assert.equal(response.status, 201);
  return { client, csrf: response.body.csrfToken as string, userId: response.body.user.id as string };
}

test('authentication, CSRF, private ownership, legacy isolation, sessions, and logout', async () => {
  const anon = agent();
  assert.equal((await anon.get('/api/v1/cases')).status, 401);
  const bootstrap = await anon.get('/api/v1/auth/me');
  assert.equal(bootstrap.body.user, null);
  assert.equal((await anon.post('/api/v1/auth/register').set('Origin', origin).send({ name: 'Missing token', email: 'missing@example.test', password: 'a-long-test-password-42' })).status, 403);
  assert.equal((await anon.post('/api/v1/auth/register').set('Origin', 'https://evil.example').set('X-CSRF-Token', bootstrap.body.csrfToken).send({ name: 'Wrong origin', email: 'wrong@example.test', password: 'a-long-test-password-42' })).status, 403);

  const accountA = await createAccount('owner-a@example.test', 'Owner A');
  userA = accountA.userId; csrfA = accountA.csrf;
  const passwordRecord = await UserModel.findById(userA).select('+passwordHash');
  assert.ok(passwordRecord?.passwordHash.startsWith('$argon2id$'));
  assert.equal(JSON.stringify((await accountA.client.get('/api/v1/auth/me')).body).includes('passwordHash'), false);
  const registrationCookie = (await accountA.client.get('/api/v1/auth/me')).headers['set-cookie'];
  assert.match(String(registrationCookie), /HttpOnly/);
  assert.match(String(registrationCookie), /SameSite=Lax/);
  assert.match(String(registrationCookie), /Expires=/);
  const cookieExpiry = Date.parse(String(registrationCookie).match(/Expires=([^;]+)/)?.[1] ?? '');
  assert.ok(cookieExpiry - Date.now() > 13 * 24 * 60 * 60 * 1000 && cookieExpiry - Date.now() <= 14 * 24 * 60 * 60 * 1000);
  const sessionDocument = await mongoose.connection.collection('sessions').findOne({});
  assert.ok(sessionDocument, 'session data is persisted in MongoDB');
  assert.ok(sessionDocument.expires instanceof Date && sessionDocument.expires.getTime() > Date.now());
  assert.equal((await accountA.client.get('/api/v1/auth/me')).body.user.id, userA, 'session should survive another request/refresh');

  const duplicateAgent = agent();
  const duplicateBootstrap = await duplicateAgent.get('/api/v1/auth/me');
  const duplicate = await withSecurity(duplicateAgent.post('/api/v1/auth/register').send({ name: 'Dup', email: 'OWNER-A@example.test', password: 'a-long-test-password-42' }), duplicateBootstrap.body.csrfToken);
  assert.equal(duplicate.status, 409, 'email uniqueness is case-insensitive');

  const invalidCsrfAgent = agent();
  const invalidCsrf = await invalidCsrfAgent.get('/api/v1/auth/me');
  assert.equal((await invalidCsrfAgent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', 'wrong').send({ email: 'owner-a@example.test', password: 'a-long-test-password-42' })).status, 403);
  const loginAgent = agent();
  const loginBootstrap = await loginAgent.get('/api/v1/auth/me');
  const login = await withSecurity(loginAgent.post('/api/v1/auth/login').send({ email: 'owner-a@example.test', password: 'wrong-password-123' }), loginBootstrap.body.csrfToken);
  assert.equal(login.status, 401);
  const validLogin = await withSecurity(loginAgent.post('/api/v1/auth/login').send({ email: 'owner-a@example.test', password: 'a-long-test-password-42' }), loginBootstrap.body.csrfToken);
  assert.equal(validLogin.status, 200);
  assert.equal(validLogin.body.user.id, userA);
  assert.notEqual(loginBootstrap.headers['set-cookie']?.[0]?.split(';')[0], validLogin.headers['set-cookie']?.[0]?.split(';')[0], 'login rotates the session id');

  const createdCase = await CaseModel.create({ ownerId: userA, publicId: 'owner-a-case-private', title: 'Private file', synopsis: 'private', premise: 'A private fictional mystery case premise.', difficulty: 'medium', topic: 'Theft', incident: {}, suspects: [{ id: 'suspect-a', name: 'A' }, { id: 'suspect-b', name: 'B' }], timeline: [], evidence: [], solutionPrivate: { culpritSuspectId: 'suspect-a', explanation: 'reason', supportingEvidenceIds: [], alternativeExplanation: 'alternative' }, status: 'investigating' });
  caseId = createdCase.publicId;
  const solvedCase = await CaseModel.create({ ownerId: userA, publicId: 'owner-a-case-to-solve', title: 'Solved file', synopsis: 'private', premise: 'Another private fictional mystery premise.', difficulty: 'medium', topic: 'Theft', incident: {}, suspects: [{ id: 'suspect-a', name: 'A' }], timeline: [], evidence: [], solutionPrivate: { culpritSuspectId: 'suspect-a', explanation: 'reason', supportingEvidenceIds: [], alternativeExplanation: 'alternative' }, status: 'investigating' });
  solvedCaseId = solvedCase.publicId;
  await CaseModel.create({ publicId: 'legacy-ownerless-case', title: 'Legacy file', synopsis: 'unassigned', premise: 'Legacy stays anonymous.', difficulty: 'easy', topic: 'General Mystery', incident: {}, suspects: [], timeline: [], evidence: [], solutionPrivate: { culpritSuspectId: '' }, status: 'investigating' });

  const accountB = await createAccount('owner-b@example.test', 'Owner B');
  userB = accountB.userId; csrfB = accountB.csrf;
  assert.deepEqual((await accountB.client.get('/api/v1/cases')).body.cases, []);
  assert.equal((await accountB.client.get(`/api/v1/cases/${caseId}`)).status, 404);
  assert.equal((await withSecurity(accountB.client.post(`/api/v1/cases/${caseId}/accusation`).send({ suspectId: 'suspect-a' }), csrfB)).status, 404);
  assert.equal((await accountB.client.get('/api/v1/cases/legacy-ownerless-case')).status, 404);
  const ownHistory = await accountA.client.get('/api/v1/cases');
  assert.deepEqual(ownHistory.body.cases.map((row: { id: string }) => row.id).sort(), [caseId, solvedCaseId].sort());
  assert.equal((await accountA.client.get(`/api/v1/cases/${caseId}`)).status, 200);
  assert.equal((await accountA.client.post('/api/v1/cases').set('Origin', origin).send({ premise: 'This case write is blocked before generation because its CSRF header is missing.', topic: 'Theft', difficulty: 'medium' })).status, 403);
  assert.equal((await accountA.client.post(`/api/v1/cases/${caseId}/accusation`).set('Origin', origin).send({ suspectId: 'suspect-a' })).status, 403, 'case writes require CSRF');
  const solved = await withSecurity(accountA.client.post(`/api/v1/cases/${solvedCaseId}/accusation`).send({ suspectId: 'suspect-a' }), csrfA);
  assert.equal(solved.status, 200);
  assert.equal((await CaseModel.findOne({ publicId: solvedCaseId }))?.status, 'solved');
  const incorrect = await withSecurity(accountA.client.post(`/api/v1/cases/${caseId}/accusation`).send({ suspectId: 'suspect-b' }), csrfA);
  assert.equal(incorrect.body.result.correct, false);
  assert.equal((await CaseModel.findOne({ publicId: caseId }))?.status, 'investigating');
  const legacy = await CaseModel.findOne({ publicId: 'legacy-ownerless-case' }).lean();
  assert.equal(legacy?.ownerId, undefined, 'legacy record remains unassigned');

  const logout = await withSecurity(accountA.client.post('/api/v1/auth/logout'), csrfA);
  assert.equal(logout.status, 204);
  assert.match(String(logout.headers['set-cookie']), /amr\.sid=/, 'logout clears the configured development cookie');
  assert.equal((await accountA.client.get('/api/v1/auth/me')).body.user, null);
  assert.equal((await accountA.client.get('/api/v1/cases')).status, 401);
});
