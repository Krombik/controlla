import { useLayoutEffect, useRef } from 'react';

import type { Control, SelectValue } from '#types';
import type { FormOptions, FormState } from '#form/types';
import type { FormInternals } from '#form/internal/types';
import makeForm from '#form/internal/makeForm';
import { attachForm } from '#form/internal/entry';

/**
 * Creates a form over the {@link control}: a registry the `Field`s under its
 * `FormProvider` attach their validators to, plus the submit orchestration
 * over them.
 *
 * The attachment is loose. The {@link control} is what gets submitted and
 * what `reset` restores - including paths no field is mounted on - while
 * validation, `$isValid` and the submit sweep come from whatever registered,
 * so a field over some other control still takes part.
 *
 * The handle is created once and kept for the component's whole life, while
 * the {@link options} are re-read on every render. The baseline is taken when
 * the form is created and moves to whatever a successful submit or a `reset`
 * wrote - and, over an async {@link control}, to every value a load hands over:
 * the first one it waited for, and whatever a reload replaces it with.
 *
 * So a form over a control that can reload underneath it (`invalidate`,
 * `reloadOnFocus`, `reloadIfStale`, a poll) should not be editable while the
 * reload is in flight: an edit committed during one is taken for what the load
 * brought, and baselines itself. Nothing here prevents it - a reloading control
 * still holds its value and its fields still write - so gate the fields on
 * `selectLoading` if that can happen. A reload discards the edits along with the
 * value they were made to either way.
 *
 * @example
 * ```tsx
 * const $values = useControl({ email: '' });
 *
 * const form = useForm($values, {
 *   validateOn: 'blur',
 *   submit: (values) => api.save(values),
 * });
 *
 * return (
 *   <FormProvider form={form}>
 *     <form onSubmit={form.submit}>
 *       <Field
 *         control={$values.email}
 *         validate={(email) => (email.includes('@') ? undefined : 'invalid email')}
 *         render={(props, { $error }) => (
 *           <input {...props} value={useValue($values.email)} />
 *         )}
 *       />
 *     </form>
 *   </FormProvider>
 * );
 * ```
 */
const useForm = <C extends Control, E = any>(
  control: C,
  options: FormOptions<SelectValue<C>, E>
): FormState => {
  const ref = useRef<FormInternals>(null);

  const form = (ref.current ||= makeForm(control, options));

  form._options = options;

  // the async controls it baselines against outlive it, so what it holds on
  // them goes when the form does
  useLayoutEffect(() => attachForm(form), [form]);

  return form;
};

export default useForm;
