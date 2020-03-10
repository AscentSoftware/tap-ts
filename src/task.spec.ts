import * as T from 'fp-ts/lib/Task';

import { pipe } from 'fp-ts/lib/pipeable';
import { start, chain, tap, map, end } from './Task';

it('taps a computation', async () => {
  const increaseFn = jest.fn();
  const increase = (n: number): number => {
    increaseFn();
    return n + 1;
  };
  const probes: number[] = [];
  const probe = (n: number): T.Task<void> => {
    probes.push(n);
    return T.of(undefined);
  };
  const runTask = pipe(
    start(0),
    tap(probe),
    chain(() => T.of(100)),
    tap(probe),
    map(increase),
    tap(probe),
    map(increase),
    end(),
  );
  const result = await runTask();
  expect(result).toBe(102);
  expect(probes).toStrictEqual([0, 100, 101]);
  expect(increaseFn).toBeCalledTimes(2);
});

it('does not block', async () => {
  let probeTime = -1;
  let computationTime = -1;
  const probe = (_n: number): T.Task<void> => () =>
    new Promise(resolve =>
      setTimeout(() => {
        probeTime = Date.now();
        resolve();
      }, 500),
    );
  const doSomething = (_n: number) => (): Promise<number> =>
    new Promise(resolve =>
      setImmediate(() => {
        computationTime = Date.now();
        resolve(100);
      }),
    );
  const runTask = pipe(start(0), tap(probe), chain(doSomething), end());
  const result = await runTask();
  expect(result).toBe(100);

  expect(probeTime).toBeGreaterThan(computationTime);
});

it('waits for async computations', async () => {
  const resolveFn = jest.fn();
  const probe = (_n: number): T.Task<void> => () =>
    new Promise(resolve =>
      setTimeout(() => {
        resolve();
      }, 500),
    ).then(resolveFn);
  const doSomething = (_n: number) => (): Promise<number> =>
    new Promise(resolve =>
      setImmediate(() => {
        resolve(100);
      }),
    );
  const runTask = pipe(start(0), tap(probe), chain(doSomething), end());
  const result = await runTask();
  expect(result).toBe(100);
  expect(resolveFn).toBeCalledTimes(1);
});

it('stops waiting if timeout', async () => {
  const resolveFn = jest.fn();
  const onTimeout = jest.fn();
  const probe = (_n: number): T.Task<void> => () =>
    new Promise(resolve =>
      setTimeout(() => {
        resolve();
      }, 500),
    ).then(resolveFn);
  const doSomething = (_n: number) => (): Promise<number> =>
    new Promise(resolve =>
      setImmediate(() => {
        resolve(100);
      }),
    );
  const runTask = pipe(start(0), tap(probe), chain(doSomething), end({ timeout: 0, onError: onTimeout }));
  const result = await runTask();
  expect(result).toBe(100);
  expect(resolveFn).toBeCalledTimes(0);
  expect(onTimeout).toBeCalledWith({ errorCode: 'timeout', timeout: 0 });
});

it('ends before timeout', async () => {
  const resolveFn = jest.fn();
  const probe = (_n: number): T.Task<void> => () =>
    new Promise(resolve =>
      setTimeout(() => {
        resolve();
      }, 500),
    ).then(resolveFn);
  const doSomething = (_n: number) => (): Promise<number> =>
    new Promise(resolve =>
      setImmediate(() => {
        resolve(100);
      }),
    );
  const runTask = pipe(start(0), tap(probe), chain(doSomething), end({ timeout: 10000 }));
  const result = await runTask();
  expect(result).toBe(100);
  expect(resolveFn).toBeCalledTimes(1);
});

it('returns error if tapping fails, but main computation is not stopped', async () => {
  const onError = jest.fn();
  const probe = (_n: number): T.Task<void> => () => Promise.reject('BOOM');
  const doSomething = (_n: number) => (): Promise<number> =>
    new Promise(resolve =>
      setImmediate(() => {
        resolve(100);
      }),
    );
  const runTask = pipe(start(0), tap(probe), chain(doSomething), end({ onError }));
  const result = await runTask();
  expect(result).toBe(100);
  expect(onError).toBeCalledWith({ errorCode: 'execution', originalError: 'BOOM' });
});
