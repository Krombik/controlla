import identity from '#internal/identity';
import type { ParamStringifier } from '#router/internal/types';
import nonUndefinedIdentity from '#router/internal/nonUndefinedIdentity';

const handleStringify = (
  stringify: ((value: any) => string) | undefined,
  optional: boolean | undefined,
  defaultValue: undefined | unknown | (() => unknown)
): ParamStringifier => {
  if (optional) {
    const getDefaultValue =
      defaultValue !== undefined &&
      (typeof defaultValue != 'function' ? () => defaultValue : defaultValue);

    return stringify
      ? getDefaultValue
        ? (value) => stringify(value !== undefined ? value : getDefaultValue())
        : (value) => (value !== undefined ? stringify(value) : value)
      : getDefaultValue
        ? (value) => (value !== undefined ? value : getDefaultValue())
        : identity;
  }

  return stringify
    ? (value, key) => stringify(nonUndefinedIdentity(value, key))
    : nonUndefinedIdentity;
};

export default handleStringify;
