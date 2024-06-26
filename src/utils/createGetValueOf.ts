import { ValueKey, _SimplifiedState } from '../types';

const createGetValueOf = (valueKey: ValueKey) => (state: _SimplifiedState) =>
  state.r.get(valueKey);

export default createGetValueOf;
