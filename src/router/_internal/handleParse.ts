import identity from '#internal/identity';
import nonUndefinedIdentity from '#router/internal/nonUndefinedIdentity';
import alwaysTrue from '#internal/alwaysTrue';
import type { ParamParser } from '#router/internal/types';

const handleParse = (
  name: string,
  optional: boolean | undefined,
  parse: ((value: string, source: any) => any) | undefined,
  isValid: ((value: any, source: any) => boolean) | undefined,
  defaultValue: undefined | unknown | ((source: any) => unknown),
  fallbackValue: undefined | unknown | ((source: any) => unknown),
  initialValue: undefined | unknown | ((source: any) => unknown)
): ParamParser => {
  if (
    optional &&
    !parse &&
    !isValid &&
    defaultValue === undefined &&
    fallbackValue === undefined &&
    initialValue === undefined
  ) {
    return identity;
  }

  parse ||= identity;

  isValid ||= alwaysTrue;

  const hasInitial = initialValue !== undefined;

  const getInitialValue = (
    typeof initialValue != 'function' ? () => initialValue : initialValue
  ) as (source: any) => unknown;

  const getFallbackValue = (
    typeof fallbackValue != 'function'
      ? optional || fallbackValue !== undefined
        ? () => fallbackValue
        : (_, __, error) => {
            throw error || new Error(`${name} is not valid`);
          }
      : fallbackValue
  ) as (incorrectValue: string | undefined, source: any, error?: any) => any;

  const getDefaultValue = (
    typeof defaultValue != 'function' ? () => defaultValue : defaultValue
  ) as (source: any) => unknown;

  const safeParse: ParamParser = (value, source) => {
    let err;

    try {
      const parsed = parse(nonUndefinedIdentity(value, name), source);

      if (isValid(parsed, source)) {
        return parsed;
      }
    } catch (error) {
      err = error;
    }

    return getFallbackValue(value, source, err);
  };

  return optional
    ? (value, source, initial) =>
        value
          ? safeParse(value, source, initial)
          : initial && hasInitial
            ? getInitialValue(source)
            : getDefaultValue(source)
    : safeParse;
};

export default handleParse;
