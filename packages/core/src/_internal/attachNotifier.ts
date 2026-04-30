import { EMPTY_ARR } from '#internal/constants';
import { ControlInternalsBase, Mutable, Notifier } from '#internal/types';

const attachNotifier = (
  internals: ControlInternalsBase,
  notifier: Notifier
) => {
  let dependents = internals._dependents;

  if (dependents != EMPTY_ARR) {
    dependents.push(notifier);
  } else {
    (internals as Mutable<ControlInternalsBase>)._dependents = dependents = [
      notifier,
    ];
  }

  notifier._current = dependents;
};

export default attachNotifier;
