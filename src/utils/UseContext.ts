import { createContext } from 'react';
import { InternalUtils } from '../types';

const UseContext = createContext<Map<InternalUtils, () => void>>(null!);

export default UseContext;
