import { createContext } from 'react';

import type { FormInternals } from '#form/internal/types';

const FormContext = createContext<FormInternals | undefined>(undefined);

export default FormContext;
