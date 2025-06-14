import { createContext } from 'react';
import type { InternalAsyncControl } from '../types';

const SuspenseContext = createContext<Map<
  InternalAsyncControl,
  () => void
> | null>(null);

export default SuspenseContext;
