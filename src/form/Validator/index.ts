import type { ReactNode } from 'react';

import type { Control } from '#types';
import type { ValidatorAllProps, ValidatorProps } from '#form/types';
import useValidator from '#form/useValidator';

const Validator = ((
  props: ValidatorProps<any, any> & ValidatorAllProps<any, any>
) => {
  const errors = useValidator(
    props.control || props.controls,
    props.validate,
    props.validateOn
  );

  const render = props.render;

  return render ? render(errors) : null;
}) as {
  /**
   * `useValidator` as a component: the rule lives where the field does, and a
   * rule that only applies sometimes is `{required && <Validator … />}` rather
   * than a hook you can't call conditionally.
   *
   * {@link ValidatorProps.render render} gets the error control, for the
   * message beside the field - leave it out when only `isError` matters and it
   * renders nothing.
   *
   * @example
   * ```tsx
   * <Validator
   *   control={$values.email}
   *   validate={(email) => (email.includes('@') ? undefined : 'invalid email')}
   *   render={($error) => <ControlConsumer control={$error} />}
   * />
   * ```
   */
  <C extends Control, E = any>(props: ValidatorProps<C, E>): ReactNode;
  /**
   * The tuple form - one rule over several controls, answering with a slot per
   * control. {@link ValidatorAllProps.render render} gets one error control per
   * slot, in the same order.
   *
   * @example
   * ```tsx
   * <Validator
   *   controls={[$values.password, $values.repeat]}
   *   validate={([password, repeat]) =>
   *     password === repeat ? undefined : [undefined, 'passwords differ']}
   *   render={([, $repeatError]) => <ControlConsumer control={$repeatError} />}
   * />
   * ```
   */
  <C extends readonly Control[], E = any>(
    props: ValidatorAllProps<C, E>
  ): ReactNode;
};

export default Validator;
