import type { Control } from '#types';
import type { FieldState } from '#form/types';
import type { FormInternals } from '#form/internal/types';
import useFormState from '#form/useFormState';
import useEntry from '#form/internal/useEntry';
import { getFieldState } from '#form/internal/entry';

/**
 * Returns the state of the {@link control}'s field from anywhere under the
 * form - an error summary, a section header, a revert button next to a field
 * rendered by the layout rather than by its own `Field`.
 *
 * The field doesn't have to be mounted yet: the entry is created on first
 * access and the `Field` fills its validator in when it arrives.
 *
 * @example
 * ```tsx
 * const { $error, $isDirty } = useFieldState($values.email);
 * ```
 */
const useFieldState = <C extends Control, E = any>(
  control: C
): FieldState<C, E> =>
  getFieldState(useEntry(useFormState() as FormInternals, control));

export default useFieldState;
