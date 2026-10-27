import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaseSchema } from '@mystery/shared';

const premise = 'A rare map disappeared during the museum overnight restoration session.';

test('omitted topics default to General Mystery and explicit custom topics are preserved', () => {
  assert.equal(createCaseSchema.parse({ premise }).topic, 'General Mystery');
  assert.equal(createCaseSchema.parse({ premise, topic: '  Arctic research  ' }).topic, 'Arctic research');
});
