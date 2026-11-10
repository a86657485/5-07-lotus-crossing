import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { apiLogin, apiRecordTrainReward, apiReportEvidence, apiSaveProgress, apiSubmitExam, retryPendingTrainRewards } from './client';
import type { TrainResultInput } from '../lesson/trainReward';

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
  assert.match(submitted.eventId, /^exam-[a-z0-9-]+$/);
  assert.equal(submitted.studentId, 'student-a');
  assert.equal(submitted.tier, 'base');
  await apiSubmitExam('student-a', {}, 'challenge');
  assert.equal(JSON.parse(calls[3].init?.body as string).tier, 'challenge');
  await apiReportEvidence('student-a', { eventId: 'test-event', taskId: 's2_rewrite', eventType: 'case_run' });
  assert.equal((calls[4].init?.headers as Record<string, string>).Authorization, 'Bearer tab-student-token');
});

test('an offline train best stays with its student and retries without replacing it with a longer route', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  } });
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  let offline = true;
  const sent: unknown[] = [];
  globalThis.fetch = async (url, init) => {
    if (url === '/api/login') return Response.json({ sessionToken: 'reward-token' });
    assert.equal(url, '/api/reward/train/result');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer reward-token');
    if (offline) throw new TypeError('offline');
    const body = JSON.parse(init?.body as string);
    sent.push(body);
    return Response.json({ bestLaps: body.route.length });
  };
  await apiLogin({ classId: '501', studentId: 'student-a' });
  const best: TrainResultInput = { orderIndex: 1, rule: 'fulfilled', route: ['water', 'tools', 'tools', 'tools'] };
  await assert.rejects(apiRecordTrainReward('student-a', best), /offline/);
  offline = false;
  await retryPendingTrainRewards('student-b');
  assert.deepEqual(sent, []);
  const slower: TrainResultInput = { ...best, route: ['water', ...best.route] };
  await apiRecordTrainReward('student-a', slower);
  assert.deepEqual(sent, [{ studentId: 'student-a', ...best }]);
  assert.equal(stored.size, 0);
  const next: TrainResultInput = { orderIndex: 0, rule: 'three', route: ['water', 'water', 'tools'] };
  offline = true;
  await assert.rejects(apiRecordTrainReward('student-a', next), /offline/);
  offline = false;
  await retryPendingTrainRewards('student-a');
  assert.deepEqual(sent, [{ studentId: 'student-a', ...best }, { studentId: 'student-a', ...next }]);
  assert.equal(stored.size, 0);
});

test('train reward aborts hung requests with AbortController, not AbortSignal.timeout', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  } });
  mock.timers.enable({ apis: ['setTimeout'], now: 0 });
  t.after(() => {
    mock.timers.reset();
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  let seenSignal: AbortSignal | undefined;
  globalThis.fetch = async (_url, init) => {
    if (String(_url).includes('/api/login')) {
      return Response.json({ sessionToken: 'timeout-token', state: {}, student: {} });
    }
    seenSignal = init?.signal;
    assert.ok(seenSignal, 'request must pass AbortController signal');
    // 故意挂起，等待项目的 AbortController + setTimeout 超时
    await new Promise<never>((_resolve, reject) => {
      seenSignal!.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      }, { once: true });
    });
    return Response.json({ bestLaps: 1 });
  };

  await apiLogin({ classId: '501', studentId: 'student-timeout' });
  const submission: TrainResultInput = {
    orderIndex: 0,
    rule: 'three',
    route: ['water', 'water', 'tools'],
  };
  const pending = apiRecordTrainReward('student-timeout', submission);
  mock.timers.tick(8000);
  await assert.rejects(pending, /abort/i);
  assert.ok(seenSignal?.aborted, 'signal should be aborted after timeout');
});

