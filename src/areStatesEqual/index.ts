import { State } from '../types';

/** Compares two states to determine if they are equal. */
const areStatesEqual = (state1: State, state2: State) =>
  state1._internal == state2._internal &&
  (state1._path && state1._path.join('.')) ==
    (state2._path && state2._path.join('.'));

export default areStatesEqual;
