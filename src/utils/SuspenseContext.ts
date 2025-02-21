import { createContext } from 'react';
import type { AsyncState } from '../types';

const SuspenseContext = createContext<Map<AsyncState, () => void> | null>(null);

export default SuspenseContext;
