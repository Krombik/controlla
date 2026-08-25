import type { Control } from '#types';
import type {
  ExactControl,
  NativeFieldConverters,
  NativeFieldOptions,
  NativeFieldRenderProps,
  NativeFieldType,
} from '#form/types';
import useNativeProps from '#form/internal/useNativeProps';
import { useContext } from 'react';
import FormContext from '#form/internal/FormContext';
import throwNoProvider from '#form/internal/throwNoProvider';
import { getEntry } from '#form/internal/entry';

const useNativeField = ((
  control: Control,
  options: NativeFieldOptions<any, any>
): any => {
  const form = useContext(FormContext) || throwNoProvider();

  return useNativeProps(form, getEntry(form, control), options);
}) as {
  /**
   * A field the element owns: typing goes straight into the control and
   * rerenders nothing, and the element is filled in again whenever the value
   * changes elsewhere - a `reset`, data arriving. Spread what it returns onto
   * your `input`, `select` or `textarea` and it is wired, `ref` included.
   * Anything that isn't a native form element belongs to `useField`.
   *
   * {@link NativeFieldOptions.type type} says what the field *is*, not which
   * element renders it, and the value type follows from it. `'numeric'`,
   * `'decimal'` and `'email'` render as text with the right keyboard, since the
   * native types of those names lose the caret, throw away what they can't
   * parse and validate before your own rules ever run.
   *
   * Validation lives in `useValidator`/`usePathValidator`; the field only
   * carries the error to the element, as `aria-invalid` and `aria-describedby`,
   * without rerendering. Read `useFieldState(control).$isError` for the styling.
   *
   * The same props can go on several elements - a radio group, one field shown
   * twice - on React 19. Below that, one element per field.
   *
   * Everything but the {@link control} is read once, so the type, the
   * converters and the aria ids are fixed for the field's life.
   *
   * @example
   * ```tsx
   * const amount = useNativeField($values.amount, {
   *   type: 'decimal',
   *   errorId: 'amount-error',
   * });
   *
   * return <input {...amount} />;
   * ```
   */
  <T extends NativeFieldType, C extends Control>(
    control: C,
    options: NativeFieldOptions<T, C> &
      ExactControl<T, C> & { parse?: never; format?: never }
  ): NativeFieldRenderProps<T>;
  /**
   * The same, with the value converted on its way to the control and back —
   * see {@link NativeFieldConverters}.
   *
   * @example
   * ```tsx
   * const bornAt = useNativeField($values.bornAt, {
   *   type: 'date',
   *   parse: (value) => new Date(value),
   *   format: (date) => date.toISOString().slice(0, 10),
   * });
   * ```
   */
  <T extends NativeFieldType, C extends Control>(
    control: C,
    options: NativeFieldOptions<T, C> & NativeFieldConverters<T, C>
  ): NativeFieldRenderProps<T>;
};

export default useNativeField;
