import identity from 'lodash.identity';
import nonUndefinedIdentity from '#utils/nonUndefinedIdentity';
import simpleParse from '#utils/simpleParse';
import alwaysTrue from '@react-control/core/_shared/alwaysTrue';
import type { HandleParse } from '#_types';

const handleParse = (
  name: string,
  optional: boolean | undefined,
  parse: ((value: string | undefined, source: any) => any) | undefined,
  isValid: ((value: any, source: any) => boolean) | undefined,
  defaultValue: undefined | unknown | ((source: any) => unknown),
  fallbackValue: undefined | unknown | ((source: any) => unknown)
): HandleParse => {
  if (
    optional &&
    !parse &&
    !isValid &&
    defaultValue === undefined &&
    fallbackValue === undefined
  ) {
    return simpleParse;
  }

  parse ||= identity;

  isValid ||= alwaysTrue;

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

  const safeParse: HandleParse = (target, key, value, source) => {
    let err;

    try {
      const parsed = parse(nonUndefinedIdentity(value, key), source);

      if (isValid(parsed, source)) {
        target[key] = parsed;

        return false;
      }
    } catch (error) {
      err = error;
    }

    const fallbackValue = getFallbackValue(value, source, err);

    target[key] =
      fallbackValue !== undefined ? fallbackValue : getDefaultValue(source);

    return true;
  };

  return optional
    ? (target, key, value, source) => {
        if (value) {
          return safeParse(target, key, value, source);
        }

        const defaultValue = getDefaultValue(source);

        target[key] = defaultValue;

        return defaultValue !== undefined;
      }
    : safeParse;
};

export default handleParse;
