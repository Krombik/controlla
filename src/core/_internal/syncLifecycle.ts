import { addListener, removeListener } from '#internal/flushQueue';
import type { ChangeListener, Listeners } from '#internal/types';

export function attach(
  control: Listeners<ChangeListener> | undefined,
  listener: ChangeListener | undefined,
  _: boolean
) {
  if (listener) {
    addListener(control!, listener);
  }
}

export function detach(
  control: Listeners<ChangeListener> | undefined,
  listener: ChangeListener | undefined,
  _: boolean
) {
  if (listener) {
    removeListener(control!, listener);
  }
}
