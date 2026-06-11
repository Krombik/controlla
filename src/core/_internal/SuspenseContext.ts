import { createContext } from 'react';
import type { Attachers } from '#internal/types';

const SuspenseContext = createContext<Array<Pick<Attachers, '_detach'>> | null>(
  null
);

export default SuspenseContext;
