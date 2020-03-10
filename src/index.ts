import * as T from 'fp-ts/lib/Task';
import * as E from 'fp-ts/lib/Either';
import * as TE from 'fp-ts/lib/TaskEither';
import * as W from 'fp-ts/lib/Writer';

import { fst, snd, mapLeft } from 'fp-ts/lib/Tuple';
import { pipe } from 'fp-ts/lib/pipeable';
import { getMonoid } from 'fp-ts/lib/Array';
import { identity } from 'fp-ts/lib/function';

export interface Probe<A> {
  (a: A): T.Task<void>;
}

export interface EndOptions {
  timeout?: number;
  onError?(error: TapError): void;
}

export interface TimeoutError {
  errorCode: 'timeout';
  timeout: number | undefined;
}

export interface ExecutionError {
  errorCode: 'execution';
  originalError: unknown;
}

export type TapError = TimeoutError | ExecutionError;

export type Taps = Array<Promise<E.Either<TapError, void>>>;

export type ObservableTask<A> = W.Writer<Taps, T.Task<A>>;

export const getTimeoutError = (timeout: number | undefined): TapError => ({ errorCode: 'timeout', timeout });
export const getExecutionError = (error: unknown): TapError => ({ errorCode: 'execution', originalError: error });

const M = getMonoid<Promise<E.Either<TapError, void>>>();
const writerM = W.getMonad<Taps>(getMonoid());

export type ProbeResult = E.Either<TapError, void>;

type TaskTuple<A, B> = T.Task<[A, B]>;

const fromTask = <A>(ta: T.Task<A>): TaskTuple<A, A> => T.task.map(ta, a => [a, a]);

const bimap = <A, B, C, D>(f: (a: A) => C, g: (b: B) => D) => (tt: TaskTuple<A, B>): TaskTuple<C, D> =>
  T.task.map(tt, ab => [f(fst(ab)), g(snd(ab))]);

const split = <A, B>(tab: TaskTuple<A, B>): [T.Task<A>, T.Task<B>] =>
  pipe(tab(), promise => [(): Promise<A> => promise.then(fst), (): Promise<B> => promise.then(snd)]);

const getSafeRunProbe = <A>(f: Probe<A>) => (a: A): TE.TaskEither<TapError, void> =>
  TE.tryCatch(() => f(a)(), getExecutionError);

export const tap = <A>(f: Probe<A>) => (wa: ObservableTask<A>): ObservableTask<A> =>
  W.pass(
    writerM.map(wa, fa =>
      pipe(
        fromTask(fa),
        bimap(identity, getSafeRunProbe(f)),
        split,
        mapLeft(ta => (w: Taps): Taps => M.concat(w, [T.flatten(ta)()])),
      ),
    ),
  );

export const start = <A>(a: A): ObservableTask<A> =>
  pipe(
    W.tell([] as Taps),
    W.map(() => T.of(a)),
  );

export const end = <A>(options: EndOptions = {}) => (wa: ObservableTask<A>): T.Task<A> =>
  pipe(
    W.listen(wa),
    W.map(([mainTask, taps]) => {
      let handle: NodeJS.Timeout;
      const timeout = (time: number): Promise<never> =>
        new Promise((_resolve, reject) => {
          handle = setTimeout(reject, time);
        });
      const tapTasks: TE.TaskEither<TapError, void> = pipe(
        TE.tryCatch(
          () => {
            // order is not important
            // since every tap is wrapped in try-catch, it returns all the results even if something fails
            const allTaps = Promise.all(taps)
              .then(results => {
                // TODO return an error if at least one fails, is it too strict?
                // we could use a validation monoid instead
                const firstError = results.find(E.isLeft);
                return TE.fromEither(firstError || results[0]);
              })
              .finally(() => {
                if (handle) clearTimeout(handle);
              });
            if (options.timeout !== undefined) {
              return Promise.race([timeout(options.timeout), allTaps]);
            }
            return allTaps;
          },
          // error is always of kind "timeout" since promises are wrapped in try-catch
          () => getTimeoutError(options.timeout),
        ),
        TE.flatten,
        // report errors if any
        TE.mapLeft(error => {
          if (options.onError) options.onError(error);
          return error;
        }),
      );
      // exec main process first, then logs
      return pipe(
        mainTask,
        T.map(out =>
          pipe(
            tapTasks,
            T.map(() => out),
          ),
        ),
        T.flatten,
      );
    }),
    W.evalWriter,
  );

export const branch = <A, B>(f: (fa: ObservableTask<A>) => ObservableTask<B>) => (
  wa: ObservableTask<A>,
): ObservableTask<B> =>
  W.pass(
    pipe(
      wa,
      W.map(a => {
        const wa2 = f(
          // start new computation
          pipe(
            W.tell([] as Taps),
            W.map(() => a),
          ),
        );
        return [
          W.evalWriter(wa2),
          // merge again with main computation
          (w: Taps): Taps => [...w, ...W.execWriter(wa2)],
        ];
      }),
    ),
  );
