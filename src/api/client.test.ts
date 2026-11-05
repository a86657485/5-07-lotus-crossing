import test from 'node:test';
import assert from 'node:assert/strict';
import { apiLogin, apiSaveProgress, apiSubmitExam } from './client';

test('student requests carry their login token and submit on HTTP LAN without randomUUID', async t => {
  const originalFetch = globalThis.fetch;
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues } });
  t.after(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'crypto', originalCrypto);
  });
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = async (path, init) => {
    calls.push({ path: String(path), init });
    return new Response(JSON.stringify({ sessionToken: 'tab-student-token', state: {}, student: {}, result: {} }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  await apiLogin({ classId: '501', studentId: 'student-a' });
  await apiSaveProgress('student-a', { stations: { s1_order: true } });
  assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, 'Bearer tab-student-token');
  await apiSubmitExam('student-a', { B01: 'test-choice' });
  const submitted = JSON.parse(calls[2].init?.body as string);
  assert.match(submitted.eventId, /^[a-f0-9]{32}$/);
  assert.equal(submitted.studentId, 'student-a');
  assert.equal(submitted.tier, 'base');
  await apiSubmitExam('student-a', {}, 'challenge');
  assert.equal(JSON.parse(calls[3].init?.body as string).tier, 'challenge');
});
