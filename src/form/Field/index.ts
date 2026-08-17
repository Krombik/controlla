import { useContext, type ReactNode } from 'react';

import type { Control } from '#types';
import type { FieldProps } from '#form/types';
import { INTERNALS } from '#internal/constants';
import FormContext from '#form/internal/FormContext';
import useEntry from '#form/internal/useEntry';
import { getFieldState, triggerValidate } from '#form/internal/entry';
import getValue from '#core/getValue';

const Field = ((props: FieldProps) => {
  const form = useContext(FormContext);

  const entry = useEntry(form, props.control);

  let renderProps = entry._props;

  // an entry with no render props has never been configured: this is the first
  // render, or the control changed and this is a different entry
  if (renderProps === undefined) {
    entry._validate = props.validate;

    const mode = (entry._mode =
      props.validateOn || (form && form._options.validateOn) || 'submit');

    entry._keep = !!props.keepValidator;

    const path = entry._control[INTERNALS]._path;

    entry._props = renderProps = {
      name: path ? path.join('.') : undefined,
      ref(element: HTMLElement | null) {
        // nothing binds to it here - `submit` only needs somewhere to focus
        entry._element = element || undefined;
      },
      onBlur:
        mode == 'blur'
          ? () => {
              triggerValidate(entry, getValue(entry._control));
            }
          : undefined,
    };
  }

  return props.render(renderProps, getFieldState(entry));
}) as {
  /**
   * Validates one {@link FieldProps.control control} as part of the form
   * around it, for as long as it is on screen - a field that disappears stops
   * taking part in the submit. Outside a `FormProvider` it still validates on
   * its own.
   *
   * The value stays yours to read and write: `render` gets the wiring to spread
   * on your input and the field's {@link FieldState state}, not a
   * `value`/`onChange` pair. Pass the {@link FieldRenderProps.ref ref} on and a
   * failed submit will focus the first invalid field for you.
   *
   * Everything but the {@link FieldProps.control control} is read once, so a
   * validator that depends on something changing should read it from a control
   * instead of closing over it.
   *
   * @example
   * ```tsx
   * <Field
   *   control={$values.email}
   *   validateOn='blur'
   *   validate={(email) => (email.includes('@') ? undefined : 'invalid email')}
   *   render={(props, { $field, $error }) => (
   *     <label>
   *       <input
   *         {...props}
   *         value={useValue($field)}
   *         onChange={(e) => setValue($field, e.target.value)}
   *       />
   *       <ControlConsumer control={$error} />
   *     </label>
   *   )}
   * />
   * ```
   */
  <C extends Control, E = any>(props: FieldProps<C, E>): ReactNode;
};

export default Field;
