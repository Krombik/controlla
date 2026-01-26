import noop from 'lodash.noop';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import { addAfterFlushHook } from '#internal/flushQueue';
import { INTERNALS } from '#shared-internal/constants';

const onValuesChange = ((
  controls: ReadonlyControl[],
  onChange: (values?: any[], prevValues?: any[]) => void
): (() => void) => {
  let canSchedule = true;

  const count = controls.length;

  const callbackArity = onChange.length;

  const unlisteners: Array<() => void> = Array(count);

  if (callbackArity) {
    const nextValues = Array(count);

    for (let i = 0; i < count; i++) {
      const control = controls[i][INTERNALS];

      nextValues[i] = control._get();

      unlisteners[i] = control._subscribe((nextValue) => {
        if (canSchedule) {
          canSchedule = false;

          const prevValues = callbackArity == 2 && nextValues.slice();

          addAfterFlushHook(() => {
            onChange(nextValues, prevValues as any);

            canSchedule = true;
          });
        }

        nextValues[i] = nextValue;
      });
    }
  } else {
    const scheduleCallback = () => {
      if (canSchedule) {
        canSchedule = false;

        addAfterFlushHook(() => {
          onChange();

          canSchedule = true;
        });
      }
    };

    for (let i = 0; i < count; i++) {
      unlisteners[i] = controls[i][INTERNALS]._subscribe(scheduleCallback);
    }
  }

  return () => {
    onChange = noop;

    for (let i = 0; i < count; i++) {
      unlisteners[i]();
    }
  };
}) as {
  /**
   * Registers a callback to be invoked when the values of multiple {@link controls} change.
   *
   * @param controls - The controls to monitor for changes.
   * @param onChange - The callback function invoked with the new values of the controls.
   * @returns a function to unsubscribe from the values change event.
   */
  <const S extends ReadonlyControl[]>(
    controls: S,
    onChange: (
      values: {
        [index in keyof S]: S[index] extends ReadonlyControl<infer K>
          ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
          : never;
      },
      prevValues: {
        [index in keyof S]: S[index] extends ReadonlyControl<infer K>
          ? K | (S[index] extends ReadonlyAsyncControl ? undefined : never)
          : never;
      }
    ) => void
  ): () => void;
};

export default onValuesChange;
