import type { Control } from '#types';
import type { FieldState } from '#form/types';
import type { FormInternals } from '#form/internal/types';
import useFormState from '#form/useFormState';
import useEntry from '#form/internal/useEntry';
import { getFieldState } from '#form/internal/entry';

/**
 * The state of the {@link control}'s field, from anywhere under the form - an
 * error summary, a section header, a revert button beside a field the layout
 * renders. The field itself doesn't have to be on screen yet.
 *
 * @example
 * ```tsx
 * const { $isError, $isDirty } = useFieldState($values.email);
 * ```
 */
const useFieldState = <C extends Control>(control: C): FieldState<C> =>
  getFieldState(useEntry(useFormState() as FormInternals, control, true));

export default useFieldState;
