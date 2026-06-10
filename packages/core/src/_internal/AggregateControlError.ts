const AGGREGATE_ERROR_CONTROL_MARKER = Symbol.for('rc.aggError');

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

export const isAggregateControlError = <Errors extends any[] = any[]>(
  error: any
): error is AggregateControlError<Errors> =>
  !!(error && error[AGGREGATE_ERROR_CONTROL_MARKER]);
