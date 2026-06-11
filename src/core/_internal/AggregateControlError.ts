const AGGREGATE_ERROR_CONTROL_MARKER = Symbol.for('rc.aggError');

/**
 * The error of a derived or bound control, aggregating the errors of its
 * sources. {@link AggregateControlError.errors errors} is positional: one slot
 * per source in order, the last slot — the control's own error (e.g. a thrown
 * mapper); error-free slots are `undefined`.
 */
export class AggregateControlError<Errors extends any[] = any[]> extends Error {
  readonly name = 'AggregateControlError';

  readonly errors: Readonly<Partial<Errors>>;

  readonly [AGGREGATE_ERROR_CONTROL_MARKER] = true;

  constructor(errors: Errors) {
    super(
      `${errors.reduce((acc, err) => acc + (err !== undefined), 0)} control error(s)`
    );

    this.errors = errors.slice() as Errors;
  }
}

/**
 * Checks whether the given error is an {@link AggregateControlError}. Unlike
 * `instanceof`, it stays reliable across bundled copies of the library and
 * across realms.
 *
 * @example
 * ```ts
 * onValueChange(selectError($total), (error) => {
 *   if (isAggregateControlError(error)) {
 *     error.errors.forEach((sourceError, i) => sourceError && report(i, sourceError));
 *   }
 * });
 * ```
 */
export const isAggregateControlError = <Errors extends any[] = any[]>(
  error: any
): error is AggregateControlError<Errors> =>
  !!(error && error[AGGREGATE_ERROR_CONTROL_MARKER]);
