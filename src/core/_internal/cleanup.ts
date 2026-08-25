import type { RootBase, Subscription } from '#internal/types';

/**
 * The scope collecting the subscriptions of everything created right now, set
 * by the hooks around a creation instead of threaded through it - a control
 * doesn't know a scope exists, and every kind of it reports the same way.
 */
export const cleanupScope: { _value: Subscription[] | null } = {
  _value: null,
};

/**
 * Subscribes now, or leaves it to the enclosing {@link cleanupScope scope} -
 * a hook's effect, which is what mounts and unmounts it, so a render React
 * throws away leaves nothing attached. Created outside one, a control is a
 * module-level thing: it subscribes at once and never stops.
 */
export const registerSubscription = (
  root: RootBase,
  subscription: Subscription
) => {
  const scope = cleanupScope._value;

  if (scope) {
    scope.push(subscription);

    // nothing of it is attached until the effect mounts it, so what moves in
    // between is what it will have to catch up with
    root._pending = subscription;
  } else {
    subscription._subscribe();
  }
};

/**
 * Catches the control up, if it owes one - the mount does this, and nothing
 * else: React runs the insertion effects of a commit before anything of it is
 * attached, so the catch-up reaches no listener and dispatches no rerender,
 * which is what React refuses there.
 */
export const actualizePending = (root: RootBase) => {
  const pending = root._pending;

  if (pending) {
    pending._resync();
  }
};
