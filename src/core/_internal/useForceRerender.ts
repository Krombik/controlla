import { useReducer } from 'react';

const forceRerenderReducer = (x: number) => x + 1;

const useForceRerender = () => useReducer(forceRerenderReducer, 0)[1];

export default useForceRerender;
