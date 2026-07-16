import identity from '#internal/identity';
import handleStringify from '#router/internal/handleStringify';
import type {
  HandleUnknown,
  IsUnion,
  OneOfOptions,
  PathParam,
} from '#router/internal/types';

/**
 * Declares a dynamic path segment restricted to the given string variants:
 * the route matches only when the segment is one of them, and the param is
 * typed as their union.
 *
 * @example
 * ```ts
 * createPath('orders', oneOf({ status: { variants: ['active', 'done'] } }));
 * ```
 */
const oneOf = ((param: Record<string, OneOfOptions<string[], true>>) =>
  (parsers, stringifies, pathParams, path) => {
    const name = Object.keys(param)[0];

    const { optional, variants, defaultValue } = param[name];

    const pattern = `/(?<${name}>(?:${variants
      .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')}))`;

    parsers[name] =
      optional && defaultValue ? (value) => value || defaultValue : identity;

    // no variant check on write: the union type is the validation
    stringifies[name] = handleStringify(undefined, optional, defaultValue);

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
