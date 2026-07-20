import makeDerivedControl from '#internal/makeDerivedControl';
import type {
  ControlScope,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '#types';

const createDerivedControl: {
  /**
   * Creates a {@link ControlScope control} mirroring the given async
   * {@link control}'s value (`undefined` while it loads).
   *
   * Unlike `createAsyncDerivedControl`, the derived control is plain (no
   * loading/error statuses) and recomputes on every source change — including
   * to/from `undefined`. Subscribing to it still loads loadable sources.
   *
   * Settable via `setValue` as a local override, but a source recompute
   * overrides it — the source wins when both land in the same flush.
   */
  <T>(control: ReadonlyAsyncControl<T>): ControlScope<T | undefined>;
  /** Creates a {@link ControlScope control} mirroring the given {@link control}'s value. */
  <T>(control: ReadonlyControl<T>): ControlScope<T>;
  /**
   * Creates a {@link ControlScope control} holding the async
   * {@link control}'s value passed through {@link mapper}. The {@link mapper}
   * runs on every change and must handle `undefined` (the not-ready state).
   *
   * @example
   * ```ts
   * const $itemCount = createDerivedControl($items, (items) => items?.length ?? 0);
   * ```
   */
  <T, V>(
    control: ReadonlyAsyncControl<T>,
    mapper: (value: T | undefined) => V
  ): ControlScope<V>;
  /**
   * Creates a {@link ControlScope control} holding the
   * {@link control}'s value passed through {@link mapper}.
   */
  <T, V>(control: ReadonlyControl<T>, mapper: (value: T) => V): ControlScope<V>;
  /**
   * Creates a {@link ControlScope control} combining multiple
   * controls. The {@link combiner} runs once per flush when any source
   * changes; async sources provide `value | undefined`.
   *
   * @example
   * ```ts
   * const $fullName = createDerivedControl(
   *   $firstName,
   *   $lastName,
   *   (first, last) => `${first} ${last}`
   * );
   * ```
   */
  <const C extends ReadonlyControl[], V>(
    ...args: [
      ...controls: C,
      combiner: (
        ...values: {
          [index in keyof C]: C[index] extends ReadonlyAsyncControl<infer K>
            ? K | undefined
            : C[index] extends ReadonlyControl<infer K>
              ? K
              : never;
        }
      ) => V,
    ]
  ): ControlScope<V>;
} = (...params: any[]) => makeDerivedControl(params);

export default createDerivedControl;
