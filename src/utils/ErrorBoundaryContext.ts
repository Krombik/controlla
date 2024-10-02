import { createContext } from 'react';
import type { StateInternalUtils } from '../types';

const ErrorBoundaryContext = createContext<Map<StateInternalUtils, () => void>>(
  new Map()
);

export default ErrorBoundaryContext;
