# tap-ts 🕵️

Type-safe eavesdropping

- tap computation (i.e. `Task`)
- don't block the main computation and run taps in parallel
- don't stop the main computation if tapping fails
- safely release used resources
- optionally, interrupt tapping after some time

The implementation is based on the `Writer` monad, which is often used for logging.

The idea is to have a sort non-blocking Ramda `tap` function. A probe is immediately executed, but we do not wait for a response before passing to the next step.

## Example

```typescript
const runTask = pipe(
  start(0), // start a new ObservableTask
  tap(probe), // read current value
  chain(() => T.of(100)), // here, it is like a traditional Task.chain
  tap(probe),
  map(increase), // here, it is like a traditional Task.map
  tap(probe),
  map(increase),
  end(), // before getting the result we need to release resources, wait for probes and get a Task
);
const result = await runTask();
expect(result).toBe(102);
```

## License

MIT
