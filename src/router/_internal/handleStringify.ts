import identity from '#internal/identity';
import type { ParamDefaults, ParamStringifier } from '#router/internal/types';

const handleStringify = (
  name: string,
  stringify: ((value: any) => string) | undefined,
  optional: boolean | undefined,
  defaultValue: any,
  defaults: ParamDefaults
): ParamStringifier => {
  if (optional && defaultValue !== undefined) {
    defaults.push(
      name,
      typeof defaultValue != 'function' ? () => defaultValue : defaultValue
    );
  }

  // an absent param never reaches here - the URL builders skip it
  return stringify || identity;
};

export default handleStringify;
