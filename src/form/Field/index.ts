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
   * Registers the {@link FieldProps.control control}'s validator with the
   * enclosing form for as long as it stays mounted, and renders the field
   * from its own state. Mount/unmount is the registration lifecycle, which is
   * why this is a component and not a bare hook - a conditional field
   * un-registers by disappearing.
   *
   * The value is yours to read and write: `render` gets the wiring
   * ({@link FieldRenderProps.name name}, {@link FieldRenderProps.onBlur onBlur})
   * and the field's {@link FieldState state}, not a `value`/`onChange` pair.
   *
   * Outside of a `FormProvider` it still validates on its own - it just takes
   * part in no submit.
   *
   * Attach {@link FieldRenderProps.ref ref}: a failed `submit` focuses the
   * first invalid field through it.
   *
   * Everything but {@link FieldProps.control control} is read on the first
   * render and never again - a field keeps the validator and the trigger it
   * was mounted with, and the props it hands `render` are one object for its
   * whole life. Change {@link FieldProps.control control} and the lot is read
   * again, against the entry the new control resolves to. So a validator
   * closing over something that moves should read it from a control rather
   * than capture it.
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
