import { useContext, useLayoutEffect, useRef } from 'react';

import type { Control, SelectValue } from '#types';
import type { ValidatorInternals } from '#form/internal/types';
import type {
  ControlError,
  ErrorOf,
  ValidateControls,
  ValidateOn,
} from '#form/types';
import createControl from '#core/createControl';
import noop from '#internal/noop';
import FormContext from '#form/internal/FormContext';
import { holdValidator, releaseValidator } from '#form/internal/validator';

const usePathValidator = ((
  control: Control,
  validate: (value: any) => any,
  validateOn?: ValidateOn
): any => {
  const form = useContext(FormContext);

  const ref = useRef<ValidatorInternals>(null);

  const prev = ref.current;

  // a changed control is a different rule, and takes the errors of the last one
  // with it
  const validator: ValidatorInternals =
    prev !== null && prev._controls[0] === control
      ? ((prev._validate = validate), prev)
      : (ref.current = {
          _form: form,
          _controls: [control],
          _paths: true,
          _validate: validate,
          _mode: validateOn || (form && form._options.validateOn) || 'submit',
          _reported: new Map(),
          _errorControls: new Map(),
          _attempt: 0,
          _pending: 0,
          _invalid: false,
          _marked: [],
          _pendingEntries: [],
          _unwatch: noop,
          _errorOf: (target) => {
            const controls = validator._errorControls!;

            let errorControl = controls.get(target);

            if (errorControl === undefined) {
              controls.set(
                target,
                (errorControl = createControl(validator._reported!.get(target)))
              );
            }

            return errorControl;
          },
        });

  useLayoutEffect(() => {
    holdValidator(validator);

    return () => {
      releaseValidator(validator);
    };
  }, [validator]);

  // the reader itself is one per validator; the control of an error is made the
  // first time it is asked for
  return validator._errorOf!;
}) as {
  /**
   * Validates the {@link control} as one thing and reports the errors of the
   * fields *under* it - what no single field can answer: which rows duplicate,
   * which of two dates is the wrong one.
   *
   * {@link validate} answers with one entry per control that failed, and gets
   * back a reader of them: `errorOf(control)` is that control's error, or
   * `undefined` while it has none. Nothing to report is `undefined`, or no
   * entries at all.
   *
   * The error belongs to the control it was reported for and to nothing else -
   * neither the fields under it nor the ones above turn red with it. Report
   * them too if they should. An error that belongs to the whole thing is
   * `useValidator`.
   *
   * @example
   * ```tsx
   * const errorOf = usePathValidator($values.emails, (emails) => {
   *   const seen = new Map<string, number>();
   *
   *   const errors: ControlErrors<string> = [];
   *
   *   for (let i = 0; i < emails.length; i++) {
   *     const at = seen.get(emails[i]);
   *
   *     if (at !== undefined) {
   *       errors.push([$values.emails[at], 'duplicate']);
   *
   *       errors.push([$values.emails[i], 'duplicate']);
   *     } else {
   *       seen.set(emails[i], i);
   *     }
   *   }
   *
   *   return errors;
   * });
   *
   * <ControlConsumer control={errorOf($values.emails[index])} />;
   * ```
   */
  <C extends Control, E extends ControlError>(
    control: C,
    validate: ValidateControls<SelectValue<C>, E>,
    validateOn?: ValidateOn
  ): ErrorOf<E>;
};

export default usePathValidator;
