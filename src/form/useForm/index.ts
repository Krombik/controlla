import { useLayoutEffect, useRef } from 'react';

import type { Control, SelectValue } from '#types';
import type { FormOptions, FormState } from '#form/types';
import type { FormInternals } from '#form/internal/types';
import makeForm from '#form/internal/makeForm';
import { addListener, removeListener } from '#internal/flushQueue';

/**
 * Makes a form over the {@link control}. The fields under its `FormProvider`
 * register with it, and it validates them, submits and resets them together.
 *
 * The {@link control} is what gets submitted and what `reset` restores, whole -
 * paths no field is mounted on included. Validation and `$isValid` come from
 * whatever registered, so a field over some other control still takes part.
 *
 * The form itself lasts as long as the component; the {@link options} are read
 * again on every render, so handlers can close over fresh values.
 *
 * `$isDirty` compares against the last saved values: what the {@link control}
 * held when the form appeared, then whatever a successful submit or a `reset`
 * left. Over an async control it is every value loading brings in, so waiting
 * for data is not an edit and a reload starts clean.
 *
 * Don't let people edit while a reload is on its way, though - an edit made
 * then is taken for part of what arrived. Disable the fields on `selectLoading`
 * if the control can reload while the form is open.
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

  // the async controls it baselines against outlive it, so the load watches it
  // holds on them go when the form does - and a render that never commits
  // leaves nothing behind, since this is the only thing that subscribes them
  useLayoutEffect(() => {
    const armed = form._armedRoots;

    form._attached = true;

    const it = armed.entries();

    for (let i = armed.size; i--;) {
      const item = it.next().value!;

      addListener(item[0], item[1]);
    }

    return () => {
      form._attached = false;

      const it = armed.entries();

      for (let i = armed.size; i--;) {
        const item = it.next().value!;

        removeListener(item[0], item[1]);
      }
    };
  }, [form]);

  return form;
};

export default useForm;
