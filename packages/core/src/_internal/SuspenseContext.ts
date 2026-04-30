import { createContext } from 'react';
import type { RootBase } from '#internal/types';

const SuspenseContext = createContext<Array<Pick<RootBase, '_detach'>> | null>(
  null
);

export default SuspenseContext;
