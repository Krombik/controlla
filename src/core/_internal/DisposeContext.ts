import { createContext } from 'react';

/**
 * Cleanups of the controls created by hooks under a scope that knows when it
 * is truly gone - a router page - so their sources detach right then instead
 * of waiting for the controls to be collected. `null` outside such a scope,
 * where `cleanupRegistry` stays the only teardown.
 */
const DisposeContext = createContext<Array<() => void> | null>(null);

export default DisposeContext;
