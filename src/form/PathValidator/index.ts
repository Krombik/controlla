import type { ReactNode } from 'react';

import type { Control } from '#types';
import type { ControlError, PathValidatorProps } from '#form/types';
import usePathValidator from '#form/usePathValidator';

const PathValidator = ((props: PathValidatorProps<Control>) => {
  const errorOf = usePathValidator(
    props.control,
    props.validate,
    props.validateOn
  );

  const render = props.render;

  return render ? render(errorOf) : null;
}) as {
  /**
   * `usePathValidator` as a component - the rule over a subtree, mountable
   * where the subtree is rendered and droppable with it.
   *
   * @example
   * ```tsx
   * <PathValidator
   *   control={$values.dates}
   *   validate={({ from, to }) =>
   *     from <= to ? undefined : [[$values.dates.to, 'ends before it starts']]}
   * />
   * ```
   */
  <C extends Control, E extends ControlError>(
    props: PathValidatorProps<C, E>
  ): ReactNode;
};

export default PathValidator;
