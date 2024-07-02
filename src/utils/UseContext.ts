import { createContext } from 'react';
import type { AsyncRoot } from '../types';

const UseContext = createContext<Map<AsyncRoot, () => void>>(null!);

export default UseContext;
