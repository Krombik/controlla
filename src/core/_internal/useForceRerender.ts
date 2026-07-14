import { useReducer } from 'react';

const forceRerenderReducer = (x: number) => x + 1;

/** Returns a stable callback that re-renders the component. */
const useForceRerender = () => useReducer(forceRerenderReducer, 0)[1];

export default useForceRerender;
