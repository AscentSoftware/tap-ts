import * as E from 'fp-ts/lib/Either';

import { writer } from 'fp-ts/lib/Writer';

import { TaskEither, taskEither } from 'fp-ts/lib/TaskEither';
import { of } from 'fp-ts/lib/Task';
import { pipe } from 'fp-ts/lib/pipeable';

import * as T from './index';

export type ObservableTaskEither<L, A> = T.ObservableTask<E.Either<L, A>>;

export const start: <L, A>(a: A) => ObservableTaskEither<L, A> = a => pipe(E.right(a), T.start);

export const end = <L, A>(options?: T.EndOptions) => (wa: ObservableTaskEither<L, A>): TaskEither<L, A> =>
  T.end<E.Either<L, A>>(options)(wa);

export const tap = <L, A>(f: T.Probe<A>) => (wa: ObservableTaskEither<L, A>): ObservableTaskEither<L, A> =>
  T.tap<E.Either<L, A>>(la =>
    pipe(
      la,
      E.fold(() => of(undefined), f),
    ),
  )(wa);

export const tapL = <L, A>(f: T.Probe<L>) => (wa: ObservableTaskEither<L, A>): ObservableTaskEither<L, A> =>
  T.tap<E.Either<L, A>>(la =>
    pipe(
      la,
      E.fold(f, () => of(undefined)),
    ),
  )(wa);

export const map: <L, A, B>(
  f: (a: A) => B,
) => (wa: ObservableTaskEither<L, A>) => ObservableTaskEither<L, B> = f => wa =>
  writer.map(wa, a => taskEither.map(a, f));

export const chain: <L, A, B>(
  f: (a: A) => TaskEither<L, B>,
) => (fa: ObservableTaskEither<L, A>) => ObservableTaskEither<L, B> = f => wa =>
  writer.map(wa, a => taskEither.chain(a, f));

export const mapLeft: <L, M>(
  f: (a: L) => M,
) => <A>(wa: ObservableTaskEither<L, A>) => ObservableTaskEither<M, A> = f => wa =>
  writer.map(wa, a => taskEither.mapLeft(a, f));

export const branch: <L, A, B>(
  f: (fa: ObservableTaskEither<L, A>) => ObservableTaskEither<L, B>,
) => (fa: ObservableTaskEither<L, A>) => ObservableTaskEither<L, B> = T.branch;
