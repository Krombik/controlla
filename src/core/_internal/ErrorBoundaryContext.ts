import { type ContextType, createContext } from 'react';
import type SuspenseContext from '#internal/SuspenseContext';

const ErrorBoundaryContext = createContext<Set<
  ContextType<typeof SuspenseContext>
> | null>(null);

export default ErrorBoundaryContext;
