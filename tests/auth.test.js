import './setup.js';
import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

import { authMiddleware, requireAuth } from '../api/_middlewares/auth.js';

const makeMockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

test('authMiddleware - valid JWT token', () => {
  const token = jwt.sign({ uid: 'user-123' }, 'test-jwt-secret-key-12345');
  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
  const res = makeMockResponse();
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  authMiddleware(req, res, next);

  assert.strictEqual(req.authUid, 'user-123');
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('authMiddleware - invalid JWT token', () => {
  const req = {
    headers: {
      authorization: 'Bearer invalid-token-value',
    },
  };
  const res = makeMockResponse();
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  authMiddleware(req, res, next);

  assert.strictEqual(req.authUid, undefined);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
  assert.deepStrictEqual(res.body, { error: 'Não autorizado. Faça login novamente.' });
});

test('authMiddleware - legacy token when fallback disabled', () => {
  process.env.ENABLE_LEGACY_SECURITY_TOKEN = 'false';
  process.env.SECURITY_TOKEN = 'legacy-token-value';
  process.env.APP_UID = 'odair';

  const req = {
    headers: {
      'x-cn-security': 'legacy-token-value',
    },
  };
  const res = makeMockResponse();
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  authMiddleware(req, res, next);

  assert.strictEqual(req.authUid, undefined);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
});

test('authMiddleware - legacy token when fallback enabled', () => {
  process.env.ENABLE_LEGACY_SECURITY_TOKEN = 'true';
  process.env.SECURITY_TOKEN = 'legacy-token-value';
  process.env.APP_UID = 'odair';

  const req = {
    headers: {
      'x-cn-security': 'legacy-token-value',
    },
  };
  const res = makeMockResponse();
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  authMiddleware(req, res, next);

  assert.strictEqual(req.authUid, 'odair');
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, 200);
});

test('requireAuth helper', () => {
  const reqNoAuth = { authUid: undefined };
  const resNoAuth = makeMockResponse();
  const resultNoAuth = requireAuth(reqNoAuth, resNoAuth);

  assert.strictEqual(resultNoAuth, null);
  assert.strictEqual(resNoAuth.statusCode, 401);
  assert.deepStrictEqual(resNoAuth.body, { error: 'Não autorizado.' });

  const reqAuth = { authUid: 'user-456' };
  const resAuth = makeMockResponse();
  const resultAuth = requireAuth(reqAuth, resAuth);

  assert.strictEqual(resultAuth, 'user-456');
  assert.strictEqual(resAuth.statusCode, 200);
});
