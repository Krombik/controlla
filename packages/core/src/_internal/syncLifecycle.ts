import { addListener, removeListener } from '#internal/flushQueue';
import { ChangeListener, Listeners } from '#internal/types';

export function attach(
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  _: boolean
) {
  if (control) {
    addListener(control, listener!);
  }
}

export function detach(
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  _: boolean
) {
  if (control) {
    removeListener(control, listener!);
  }
}
