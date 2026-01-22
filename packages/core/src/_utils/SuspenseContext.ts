import { createContext } from 'react';

const SuspenseContext = createContext<Array<() => void> | null>(null);

export default SuspenseContext;
