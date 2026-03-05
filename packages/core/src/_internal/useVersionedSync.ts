import type { useSyncExternalStore as _useSyncExternalStore } from 'react';
import type { RootControlNode } from './types';

function useVersionedSync(
  this: RootControlNode,
  useSyncExternalStore: typeof _useSyncExternalStore
) {
  const self = this;

  useSyncExternalStore(self._subscribe, () => self._version);

  return self._get();
}

export default useVersionedSync;
