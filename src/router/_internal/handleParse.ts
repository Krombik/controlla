import identity from 'lodash.identity';
import nonUndefinedIdentity from '#router/internal/nonUndefinedIdentity';
import simpleParse from '#router/internal/simpleParse';
import alwaysTrue from '#internal/alwaysTrue';
import type { HandleParse } from '#router/internal/types';

const handleParse = (
  name: string,
  optional: boolean | undefined,
  parse: ((value: string, source: any) => any) | undefined,
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

        return;
      }
    } catch (error) {
      err = error;
    }

    const fallbackValue = getFallbackValue(value, source, err);

    target[key] =
      fallbackValue !== undefined ? fallbackValue : getDefaultValue(source);
  };

  return optional
    ? (target, key, value, source) => {
        if (value) {
          safeParse(target, key, value, source);
        } else {
          target[key] = getDefaultValue(source);
        }
      }
    : safeParse;
};

export default handleParse;
