import { createContext } from 'react';
import type { InternalAsyncState } from '../types';

const SuspenseContext = createContext<Map<
  InternalAsyncState,
  () => void
> | null>(null);

export default SuspenseContext;
