import { useContext, useEffect, useRef } from 'react';

import type { Control, ControlScope, SelectValue } from '#types';
import type { ValidatorInternals } from '#form/internal/types';
import type { Validate, ValidateAll, ValidateOn } from '#form/types';
import createControl from '#core/createControl';
import noop from '#internal/noop';
import watchValue from '#core/watchValue';
import FormContext from '#form/internal/FormContext';
import throwNoProvider from '#form/internal/throwNoProvider';
import {
  distribute,
  holdValidator,
  releaseValidator,
} from '#form/internal/validator';

const useValidator = ((
  target: Control | readonly Control[],
  validate: (value: any) => any,
  validateOn?: ValidateOn
): any => {
  const form = useContext(FormContext) || throwNoProvider();

  const ref = useRef<ValidatorInternals>(null);

  const tuple = Array.isArray(target);

  const controls = tuple ? (target as readonly Control[]) : [target as Control];

  const prev = ref.current;

  let same = prev !== null && prev._controls.length === controls.length;

  if (same) {
    for (let i = controls.length; i--;) {
      if (prev!._controls[i] !== controls[i]) {
        same = false;

        break;
      }
    }
  }

  // a changed control is a different rule, and takes the error of the last one
  // with it
  const validator: ValidatorInternals = same
    ? ((prev!._validate = validate), prev!)
    : (ref.current = {
        _form: form,
        _controls: controls,
        _tuple: tuple,
        _validate: validate,
        _mode: validateOn || (form && form._options.validateOn) || 'submit',
        _errorControl: createControl(undefined),
        _attempt: 0,
        _pending: 0,
        _invalid: false,
        _marked: [],
        _pendingEntries: [],
        _unwatch: noop,
      });

  useEffect(() => {
    holdValidator(validator);

    // an error written from outside a validator - a rejection coming back from
    // the server - marks its field like any other
    const unwatch = watchValue(validator._errorControl!, (error) => {
      distribute(validator, error);
    });

    return () => {
      unwatch();

      releaseValidator(validator);
    };
  }, [validator]);

  if (!tuple) {
    return validator._errorControl;
  }

  // one control per slot, each reading its own error
  let errors = validator._errors;

  if (errors === undefined) {
    const errorControl = validator._errorControl as any;

    errors = validator._errors = Array(controls.length);

    for (let i = controls.length; i--;) {
      errors[i] = errorControl[i];
    }
  }

  return errors;
}) as {
  /**
   * Validates the {@link control} for as long as this is mounted, and hands
   * back the error as a control - `undefined` while the value passes, whatever
   * {@link validate} returned otherwise. The shape is yours: a message, or the
   * props of whatever renders one, reachable per part
   * (`$error.message`).
   *
   * The error belongs to this control alone. A field over it reads `isError`
   * (or `useFieldState(control).$isError`) without knowing which validator
   * holds it, so several validators can cover the same control.
   *
   * {@link validateOn} says when it runs on its own, defaulting to the form's
   * (`'submit'` unless the form says otherwise). Whatever the trigger, an error
   * revalidates live until it clears. {@link validate} itself is read every
   * render, so closing over props is safe - and it must not throw: catch what
   * can fail and answer with an error instead.
   *
   * @example
   * ```tsx
   * const $error = useValidator($values.email, (email) =>
   *   email.includes('@') ? undefined : 'invalid email');
   *
   * return <ControlConsumer control={$error} />;
   * ```
   */
  <C extends Control, E = any>(
    control: C,
    validate: Validate<SelectValue<C>, E>,
    validateOn?: ValidateOn
  ): ControlScope<E | undefined>;
  /**
   * The same for a rule over several controls - a repeated password, a date
   * range, "at least one of these". It gets every value and answers with a slot
   * per control, so the error lands on the field that should show it:
   * `[undefined, 'passwords differ']` marks the second one only.
   *
   * Any of them changing is what re-runs it, and one blur of any of them is
   * enough for `'blur'`. A control it only reads - where a rejection from the
   * server is kept, say - is one whose slot it leaves `undefined`: watched, and
   * never marked.
   *
   * @example
   * ```tsx
   * const [, $repeatError] = useValidator(
   *   [$values.password, $values.repeat],
   *   ([password, repeat]) =>
   *     password === repeat ? undefined : [undefined, 'passwords differ']
   * );
   * ```
   */
  <C extends readonly Control[], E = any>(
    controls: C,
    validate: ValidateAll<C, E>,
    validateOn?: ValidateOn
  ): { [Key in keyof C]: ControlScope<E | undefined> };
};

export default useValidator;
