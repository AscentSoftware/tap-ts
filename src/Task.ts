import { Task, task } from 'fp-ts/lib/Task';
import { writer } from 'fp-ts/lib/Writer';
import * as T from '.';

export const start: <A>(a: A) => T.ObservableTask<A> = T.start;

export const end = <A>(options?: T.EndOptions) => (wa: T.ObservableTask<A>): Task<A> => T.end<A>(options)(wa);

export const tap: <A>(f: T.Probe<A>) => (wa: T.ObservableTask<A>) => T.ObservableTask<A> = T.tap;

// TODO I should try-catch map and chain as well
// otherwise if I get an unhandled exception, promises are not released

export const map: <A, B>(f: (a: A) => B) => (wa: T.ObservableTask<A>) => T.ObservableTask<B> = f => wa =>
  writer.map(wa, a => task.map(a, f));

export const chain: <A, B>(f: (a: A) => Task<B>) => (fa: T.ObservableTask<A>) => T.ObservableTask<B> = f => wa =>
  writer.map(wa, a => task.chain(a, f));
