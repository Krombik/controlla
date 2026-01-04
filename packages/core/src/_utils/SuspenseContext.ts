import { createContext } from 'react';
import type { InternalAsyncControl } from '#_types';

const SuspenseContext = createContext<Map<
  InternalAsyncControl,
  () => void
> | null>(null);

export default SuspenseContext;
