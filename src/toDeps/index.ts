import { State } from '../types';

const toDeps = (state: State): [{}, string | undefined] => [
  state._internal,
  state._path && state._path.join('.'),
];

export default toDeps;
