import { useInsertionEffect } from 'react';
import type { Subscription } from '#internal/types';

/**
 * Mounts what the creation reported, and mounts it again every time the effect
 * does - an `Activity` coming back re-subscribes what hiding it dropped, and
 * catches up with whatever moved meanwhile. {@link deps} is what rebuilding the
 * control changes: the effect then unsubscribes the previous one and subscribes
 * whatever took its place.
 *
 * An insertion effect, so every one of these runs before any layout effect of
 * the commit - React runs one walk per kind - which is what puts the catch-up
 * ahead of every reader, whichever component holds it. Nothing of the tree is
 * attached that early, so the catch-up dispatches no rerender, which is what
 * React refuses here.
 */
const useSubscription = (subscription: Subscription, deps: unknown[]) => {
  useInsertionEffect(() => {
    subscription._subscribe();

    return () => {
      subscription._cleanup();
    };
  }, deps);
};

export default useSubscription;
