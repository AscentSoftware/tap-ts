import * as TE from 'fp-ts/lib/TaskEither';
import * as T from 'fp-ts/lib/Task';

import { pipe } from 'fp-ts/lib/pipeable';
import { start, chain, tap, map, end, tapL, branch } from './TaskEither';

it('taps a computation that could fail', async () => {
  const increase = (n: number): number => n + 1;
  const probes: number[] = [];
  const probe = (n: number): T.Task<void> => {
    probes.push(n);
    return T.of(undefined);
  };
  const runTask = pipe(
    start(0),
    tap(probe),
    chain(() => TE.right(100)),
    tap(probe),
    map(increase),
    tap(probe),
    map(increase),
    end(),
  );
  const result = await runTask();
  expect(result).toStrictEqual({ _tag: 'Right', right: 102 });
  expect(probes).toStrictEqual([0, 100, 101]);
});

it('taps a failure', async () => {
  const increase = (n: number): number => n + 1;
  const probes: number[] = [];
  const probesL: string[] = [];
  const probe = (n: number): T.Task<void> => {
    probes.push(n);
    return T.of(undefined);
  };
  const probeL = (error: string): T.Task<void> => {
    probesL.push(error);
    return T.of(undefined);
  };
  const runTask = pipe(
    start<string, number>(0),
    tap(probe),
    chain(() => TE.left('BOOM')), // something went wrong!
    tap(probe),
    map(increase),
    tapL(probeL),
    tap(probe),
    map(increase),
    end(),
  );
  const result = await runTask();
  expect(result).toStrictEqual({ _tag: 'Left', left: 'BOOM' });
  expect(probes).toStrictEqual([0]);
  expect(probesL).toStrictEqual(['BOOM']);
});

it('branches a computation', async () => {
  const fn = jest.fn();
  const increase = (n: number): number => n + 1;
  const probes: number[] = [];
  const probe = (n: number): T.Task<void> => {
    probes.push(n);
    return T.of(undefined);
  };
  const runTask = pipe(
    start<string, number>(0),
    tap(probe),
    chain(() => TE.right(100)),
    tap(probe),
    branch(wa => {
      return pipe(
        wa,
        chain(a => {
          fn();
          return TE.right(a * 2);
        }),
      );
    }),
    tap(probe),
    map(increase),
    tap(probe),
    map(increase),
    end(),
  );
  const result = await runTask();
  expect(result).toStrictEqual({ _tag: 'Right', right: 202 });
  expect(probes).toStrictEqual([0, 100, 200, 201]);
  expect(fn).toBeCalledTimes(1);
});
