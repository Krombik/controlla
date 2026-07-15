import type {
  ArrayOptions,
  HandleUnknown,
  IsUnion,
  PathParam,
} from '#router/internal/types';

const parseArray = (value: string) => value.split('/');

const stringifyArray = (value: string[], key: string) => {
  if (!value.length) {
    throw new Error(`${key} is empty`);
  }

  return value.join('/');
};

/**
 * Declares a dynamic path segment whose value is a `/`-joined array of
 * strings (e.g. `/tags/red/blue/green`). Takes exactly one
 * `{ name: options }` pair; unlike `param`/`query`, the segment is always
 * required: there's no optional variant.
 *
 * `options` is either `false` (the raw `string[]`) or an `ArrayOptions`
 * object with `parse`/`stringify` for a typed array. Stringifying an empty
 * array throws.
 *
 * @example
 * ```ts
 * createPath('search', arrayParam({ tags: false }));   // /search/red/blue/green
 * ```
 */
const arrayParam = ((param: Record<string, ArrayOptions<any> | false>) =>
  (parsers, stringifies, pathParams, path) => {
    const name = Object.keys(param)[0];

    const options = param[name];

    const parse = options && options.parse;

    const stringify = options && options.stringify;

    parsers[name] = parse
      ? (value) => parse(parseArray(value!))
      : (parseArray as never);

    stringifies[name] = stringify
      ? (value, name) => stringifyArray(stringify(value), name)
      : stringifyArray;

    path.push(name);

    pathParams.push(name);

    return `(?:/(?<${name}>(?:[^/]+(?:/[^/]+)*)))?`;
  }) as {
  <
    Values extends Record<string, unknown>,
    const P extends Record<keyof Values, any>,
    Source,
  >(
    param: {
      [key in keyof Values]: ArrayOptions<HandleUnknown<Values[key], string[]>>;
    } & P
  ): (IsUnion<keyof P> extends false ? unknown : never) &
    PathParam<
      {
        [key in keyof P]: P[key] extends boolean
          ? [string[], false]
          : P[key] extends ArrayOptions<infer V>
            ? [HandleUnknown<V, string[]>, false]
            : never;
      },
      HandleUnknown<Source, never>
    >;
};

export default arrayParam;
