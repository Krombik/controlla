import nonUndefinedIdentity from '#utils/nonUndefinedIdentity';
import simpleParse from '#utils/simpleParse';
import type { HandleUnknown, IsUnion, OneOfOptions, PathParam } from '#_types';

const oneOf = ((param: Record<string, OneOfOptions<string[], true>>) =>
  (parsers, stringifies, pathParams, path) => {
    const name = Object.keys(param)[0];

    const { optional, variants, defaultValue } = param[name];

    const pattern = `/(?<${name}>(?:${variants
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')}))`;

    const set = new Set(variants);

    const isCorrectVariant = set.has.bind(set);

    parsers.set(
      name,
      optional && defaultValue
        ? (target, key, value) => {
            target[key] = value || defaultValue;

            return !value && !!defaultValue;
          }
        : simpleParse
    );

    stringifies.set(
      name,
      optional
        ? (value, key) => {
            value ||= defaultValue;

            if (value === undefined || isCorrectVariant(value)) {
              return value;
            }

            throw new Error(`${key} has incorrect "${value}" variant`);
          }
        : (value, key) => {
            if (isCorrectVariant(nonUndefinedIdentity(value, key))) {
              return value;
            }

            throw new Error(`${key} has incorrect "${value}" variant`);
          }
    );

    path.push(name);

    pathParams.push(name);

    return optional ? `(?:${pattern})?` : pattern;
  }) as {
  <
    const O extends { [key in keyof Variants]: unknown },
    Variants extends Record<string, string[]>,
    const P extends Record<keyof Variants, any>,
    Source,
  >(
    param: {
      [key in keyof Variants & keyof O]: OneOfOptions<
        Variants[key],
        HandleUnknown<O[key], false>
      >;
    } & P
  ): (IsUnion<keyof P> extends false ? unknown : never) &
    PathParam<
      {
        [key in keyof P]: P[key] extends OneOfOptions<infer V, infer O>
          ? [
              (
                | V[number]
                | (O extends true
                    ? P[key] extends { defaultValue: infer K }
                      ? Extract<K, undefined>
                      : undefined
                    : never)
              ),
              O extends true ? true : false,
            ]
          : never;
      },
      HandleUnknown<Source, never>
    >;
};

export default oneOf;
