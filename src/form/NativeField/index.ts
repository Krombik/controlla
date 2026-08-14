import { useContext, type ReactNode } from 'react';

import type { Control } from '#types';
import type {
  ExactControl,
  NativeFieldConverters,
  NativeFieldProps,
  NativeFieldType,
} from '#form/types';
import { INTERNALS } from '#internal/constants';
import FormContext from '#form/internal/FormContext';
import useEntry from '#form/internal/useEntry';
import identity from '#internal/identity';
import { getFieldState, triggerValidate } from '#form/internal/entry';
import { getKind, readElement, setElement } from '#form/internal/native';

const NativeField = ((
  props: NativeFieldProps &
    Partial<NativeFieldConverters<NativeFieldType, Control>>
) => {
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

    const kind = (entry._native = getKind(props.type));

    entry._scheduler = props.scheduler;

    entry._parse = props.parse || identity;

    entry._format = props.format || identity;

    entry._errorId = props.errorId;

    entry._describedBy = props.describedBy;

    const path = entry._control[INTERNALS]._path;

    // the attributes the type implies are as fixed as the type, so they are
    // merged in here rather than spread over these on every render
    entry._props = renderProps = Object.assign(
      {
        name: path ? path.join('.') : undefined,
        ref(element: HTMLElement | null) {
          setElement(entry, element);
        },
        onBlur:
          mode == 'blur'
            ? () => {
                triggerValidate(entry, readElement(entry));
              }
            : undefined,
      },
      kind._attrs
    );
  }

  return props.render(renderProps, getFieldState(entry));
}) as {
  /**
   * A field the element itself owns: it is read on every `input`/`change` and
   * written back whenever the control moves elsewhere (a `reset`, an async
   * fill), so typing rerenders nothing.
   *
   * {@link NativeFieldProps.type type} says what the field *is*, not which
   * element renders it — `NativeField` emits the attributes that behave best
   * today, and the value type follows from it. `'numeric'` and `'email'`
   * render as `text` with an `inputmode`: the native `number` and `email`
   * types have no text cursor to restore a caret in, run validation that
   * would block submit before your validators see it, and — for `number` —
   * silently discard what they can't parse.
   *
   * Everything it needs is in the props it hands to
   * {@link NativeFieldProps.render render}, `ref` included. Anything that
   * isn't a native form element belongs to `Field` instead.
   *
   * Everything but {@link NativeFieldProps.control control} is read on the
   * first render and never again - the type, the converters, the trigger and
   * the aria ids are all fixed, and the props handed to
   * {@link NativeFieldProps.render render} are one object for the field's
   * whole life. Change {@link NativeFieldProps.control control} and the lot is
   * read again, against the entry the new control resolves to.
   *
   * @example
   * ```tsx
   * <NativeField
   *   type='decimal'
   *   control={$values.amount}
   *   errorId='amount-error'
   *   validate={(amount) => (amount ? undefined : 'required')}
   *   render={(props, { $error }) => (
   *     <>
   *       <input {...props} />
   *       <ControlConsumer control={$error} render={(error) => (
   *         <span id='amount-error'>{error}</span>
   *       )} />
   *     </>
   *   )}
   * />
   * ```
   */
  <T extends NativeFieldType, C extends Control, E = any>(
    props: NativeFieldProps<T, C, E> &
      ExactControl<T, C> & { parse?: never; format?: never }
  ): ReactNode;
  /**
   * The same, with the value converted on its way to the control and back —
   * see {@link NativeFieldConverters}.
   *
   * @example
   * ```tsx
   * <NativeField
   *   type='date'
   *   control={$values.bornAt}
   *   parse={(value) => new Date(value)}
   *   format={(date) => date.toISOString().slice(0, 10)}
   *   render={(props) => <input {...props} />}
   * />
   * ```
   */
  <T extends NativeFieldType, C extends Control, E = any>(
    props: NativeFieldProps<T, C, E> & NativeFieldConverters<T, C>
  ): ReactNode;
};

export default NativeField;
