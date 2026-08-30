/** A real `FormProvider`, for what the hooks under one need to be inside. */

import { createElement as h, mount } from './react.ts';
import FormProvider from '../../build/form/FormProvider/index.js';
import useForm from '../../build/form/useForm/index.js';

/**
 * Mounts a form and calls {@link inside} under its provider, handing back both
 * what `useForm` returned and what the inner hooks did. The provider is the
 * real one - a form is what a tree around the fields makes it, not something
 * a test can hold on its own.
 */
export const mountForm = async <T>(
  values: any,
  options: any,
  inside: () => T
) => {
  let form: any;

  let result!: T;

  const Inner = () => {
    result = inside();

    return null;
  };

  const App = () =>
    h(FormProvider, { form: (form = useForm(values, options)) }, h(Inner));

  const tree = await mount(h(App));

  return {
    tree,
    get form() {
      return form;
    },
    get result() {
      return result;
    },
  };
};
