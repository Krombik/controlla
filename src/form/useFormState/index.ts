import { useContext } from 'react';

import type { FormState } from '#form/types';
import FormContext from '#form/internal/FormContext';

const throwNoProvider = (): never => {
  throw new Error('no form provider');
};

/**
 * Returns the enclosing form - the same handle `useForm` created, so
 * `$isSubmitting`, `$isValid`, `$isDirty` and `submit` are reachable from
 * anywhere under the provider instead of being threaded down as props.
 *
 * Throws outside of a `FormProvider`.
 *
 * @example
 * ```tsx
 * const { $isSubmitting, $isValid } = useFormState();
 *
 * return <button disabled={useValue($isSubmitting) || !useValue($isValid)}>Save</button>;
 * ```
 */
const useFormState = (): FormState =>
  useContext(FormContext) || throwNoProvider();

export default useFormState;
