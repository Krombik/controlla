import type { ChangeListener, Lane, Notifier } from '#internal/types';

const notify = (
  listeners: ChangeListener[],
  dependents: Notifier[],
  lane: Lane,
  value: any,
  prevValue: any
) => {
  for (let i = 0, l = listeners.length; i < l; i++) {
    listeners[i](value, prevValue);
  }

  let l = dependents.length;

  if (l) {
    for (let i = 0, item = dependents[0]; true; ) {
      const control = item._ref.deref();

      if (control) {
        item._notify(lane, control, value, prevValue);

        if (++i == l) {
          return;
        }

        item = dependents[i];
      } else {
        item = dependents.pop()!;

        if (i == --l) {
          return;
        }
      }
    }
  }
};

export default notify;
