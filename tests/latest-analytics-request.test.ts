import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLatestAsyncGuard } from '@client/lib/latest-async-guard';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('dashboard request ordering', () => {
  it('ignores an older response after a newer range has completed', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const values: string[] = [];
    const guard = createLatestAsyncGuard<string>();

    const pendingFirst = guard.run(() => first.promise, (value) => values.push(value));
    const pendingSecond = guard.run(() => second.promise, (value) => values.push(value));
    second.resolve('7days');
    await pendingSecond;
    first.resolve('today');
    await pendingFirst;

    assert.deepEqual(values, ['7days']);
  });

  it('does not apply a response after its view unmounts', async () => {
    const response = deferred<string>();
    const values: string[] = [];
    const guard = createLatestAsyncGuard<string>();
    const pending = guard.run(() => response.promise, (value) => values.push(value));
    guard.invalidate();
    response.resolve('stale');
    await pending;
    assert.deepEqual(values, []);
  });
});
