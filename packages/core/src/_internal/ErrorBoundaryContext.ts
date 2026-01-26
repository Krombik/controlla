import { createContext } from 'react';

const ErrorBoundaryContext = createContext<Set<() => void> | null>(null);

export default ErrorBoundaryContext;
