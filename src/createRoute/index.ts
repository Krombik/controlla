import identity from 'lodash.identity';
import { ROOT } from '../utils/constants';
import alwaysTrue from '../utils/alwaysTrue';
import alwaysFalse from '../utils/alwaysFalse';
import type {
  AsyncRoute,
  HandleParse,
  HandleStringify,
  ParamOptions,
  PathAfterDeprecatedQuery,
  PathCreator,
  Route,
} from './types';
import {
  HandleUnknown,
  IsUnion,
  IsUnknown,
  UnionToIntersection,
} from '../types';
import noop from 'lodash.noop';

const parseArray = (value: string) => value.split('/');

const stringifyArray = (value: string[], key: string) => {
  if (!value.length) {
    throw new Error(`${key} is empty`);
  }

  return value.join('/');
};

const nonUndefinedIdentity = (value: any, key: string) => {
  if (value === undefined) {
    throw new Error(`${key} is required`);
  }

  return value;
};

const handleStringify = (
  stringify: ((value: any) => string) | undefined,
  optional: boolean | undefined,
  defaultValue: undefined | unknown | (() => unknown)
): HandleStringify => {
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

const simpleParse: HandleParse = (target, key, value) => {
  target[key] = value;

  return false;
};

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

const createRoute = (): PathCreator & AsyncRoute => {
  const parsers = new Map<string, HandleParse>();

  const stringifies = new Map<string, HandleStringify>();

  const getStringify = stringifies.get.bind(stringifies);

  return {
    _children: null,
    _getParse: parsers.get.bind(parsers),
    _getStringify: getStringify,
    _replaceDeprecatedQueryParams:
      alwaysFalse as Route['_replaceDeprecatedQueryParams'],
    _path: [] as string[],
    _pathParams: [] as string[],
    _queryParams: [] as string[],
    _source: null,
    async(source) {
      this._source = source[ROOT];

      return this as any;
    },
    segment(text: string) {
      text = '/' + text;

      const path = this._path;

      const l = path.length;

      if (l && path[l - 1][0] == '/') {
        path[l - 1] += text;
      } else {
        path.push(text);
      }

      this._regexStr += text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      return this as any;
    },
    param(
      name,
      {
        parse,
        stringify,
        isValid,
        optional,
        fallbackValue,
        defaultValue,
      }: ParamOptions<unknown, unknown, boolean, [any]> = {}
    ) {
      const pattern = `/(?<${name}>[^/]+)`;

      parsers.set(
        name,
        handleParse(name, optional, parse, isValid, defaultValue, fallbackValue)
      );

      stringifies.set(name, handleStringify(stringify, optional, defaultValue));

      this._path.push(name);

      this._pathParams.push(name);

      this._regexStr += optional ? `(?:${pattern})?` : pattern;

      return this as any;
    },
    array(name, converter) {
      const stringify = converter && converter.stringify;

      const parse = (converter && converter.parse) || identity;

      parsers.set(name, (target, key, value) => {
        target[key] = parse(parseArray(value!));

        return false;
      });

      stringifies.set(
        name,
        stringify
          ? (value, name) => stringifyArray(stringify(value), name)
          : stringifyArray
      );

      this._path.push(name);

      this._pathParams.push(name);

      this._regexStr += `(?:/(?<${name}>(?:[^/]+(?:/[^/]+)*)))?`;

      return this as any;
    },
    oneOf(
      name: string,
      variants: string[],
      optional?: boolean,
      defaultValue?: string
    ) {
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

      this._path.push(name);

      this._pathParams.push(name);

      this._regexStr += optional ? `(?:${pattern})?` : pattern;

      return this as any;
    },
    query(
      name,
      {
        parse,
        stringify,
        isValid,
        optional,
        fallbackValue,
        defaultValue,
      }: ParamOptions<unknown, unknown, boolean, [any]> = {}
    ) {
      parsers.set(
        name,
        handleParse(name, optional, parse, isValid, defaultValue, fallbackValue)
      );

      stringifies.set(name, handleStringify(stringify, optional, defaultValue));

      this._queryParams.push(name);

      return this as any;
    },
    deprecatedQuery(keys, mapper) {
      this._replaceDeprecatedQueryParams = (searchParams) => {
        let replaced = false;

        const obj: Record<string, string> = {};

        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];

          const value = searchParams[key];

          if (value) {
            replaced = true;

            obj[key] = value;
          }
        }

        if (replaced) {
          replaced = false;

          try {
            const params = mapper(obj as any);

            for (const key in params) {
              if (!(key in searchParams)) {
                const param = params[key as keyof typeof params];

                try {
                  const value = getStringify(key)!(param, key);

                  if (value) {
                    replaced = true;

                    searchParams[key] = value;
                  }
                } catch {}
              }
            }
          } catch {}
        }

        return replaced;
      };

      return this as any;
    },
    to(children) {
      this._children = children;

      return this as any;
    },
  } as PathCreator & AsyncRoute & PathAfterDeprecatedQuery;
};

declare const PATH_PARAM_MARKER: unique symbol;

type PathParam<P, Source = never> = {
  /** @internal */
  (
    parsers: Map<string, HandleParse>,
    stringifies: Map<string, HandleStringify>,
    pathParams: string[]
  ): string;
  [PATH_PARAM_MARKER]: P;
  [SOURCE]: Source;
};

declare const QUERY_PARAM_MARKER: unique symbol;

declare const SOURCE: unique symbol;

type QueryParam<
  P extends Record<string, [value: any, optional: boolean]>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Map<string, HandleParse>,
    stringifies: Map<string, HandleStringify>,
    queryParams: string[]
  ): (searchParams: Record<string, string>) => boolean;
  [QUERY_PARAM_MARKER]: P;
  [SOURCE]: Source;
};

type QueryParamWithReplace<
  P extends Record<string, [value: any, optional: boolean]>,
  Source = never,
> = QueryParam<P> & {
  replace<const S extends string[]>(
    keys: S,
    mapper: (deprecatedValues: Partial<Record<S[number], string>>) => {
      [key in keyof P]?: string;
    }
  ): QueryParam<P, Source>;
};

const query = ((
  params: Record<string, ParamOptions<unknown, unknown, boolean> | boolean>
) => {
  let deprecatedQuery: (searchParams: Record<string, string>) => boolean =
    alwaysFalse;

  const handleQuery = ((parsers, stringifies, queryParams) => {
    type Options = ParamOptions<unknown, unknown, boolean>;

    for (const name in params) {
      const options = params[name];

      let defaultValue: Options['defaultValue'],
        fallbackValue: Options['fallbackValue'],
        isValid: Options['isValid'],
        optional: Options['optional'],
        parse: Options['parse'],
        stringify: Options['stringify'];

      if (typeof options == 'object') {
        defaultValue = options.defaultValue;
        fallbackValue = options.fallbackValue;
        isValid = options.isValid;
        optional = options.optional;
        parse = options.parse;
        stringify = options.stringify;
      } else {
        optional = options;
      }

      parsers.set(
        name,
        handleParse(name, optional, parse, isValid, defaultValue, fallbackValue)
      );

      stringifies.set(name, handleStringify(stringify, optional, defaultValue));

      queryParams.push(name);
    }

    return deprecatedQuery;
  }) as QueryParamWithReplace<Record<string, any>>;

  handleQuery.replace = (keys, mapper) => {
    deprecatedQuery = (searchParams) => {
      let replaced = false;

      const obj: Record<string, string> = {};

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        const value = searchParams[key];

        if (value) {
          replaced = true;

          obj[key] = value;
        }
      }

      if (replaced) {
        replaced = false;

        try {
          const params = mapper(obj as any);

          for (const key in params) {
            if (!(key in searchParams)) {
              const param = params[key as keyof typeof params];

              if (param) {
                replaced = true;

                searchParams[key] = param;
              }
            }
          }
        } catch {}
      }

      return replaced;
    };

    return handleQuery;
  };

  return handleQuery;
}) as {
  <
    Values extends Record<string, unknown>,
    const Optionals extends { [key in keyof Values]: unknown },
    P extends Record<
      keyof Values,
      | Omit<ParamOptions<unknown, unknown, unknown>, 'isValid' | 'stringify'>
      | boolean
    >,
    _Values extends Record<keyof Values, any> = {
      [key in keyof Values]: HandleUnknown<
        Exclude<Values[key], Function>,
        string
      >;
    },
  >(
    params: P & {
      [key in keyof Values & keyof Optionals]: ParamOptions<
        HandleUnknown<Exclude<Values[key], Function>, string>,
        Optionals[key] extends true
          ? HandleUnknown<Exclude<Values[key], Function>, string>
          : never,
        HandleUnknown<Optionals[key], false>
      >;
    }
  ): QueryParamWithReplace<{
    [key in keyof Values]: [Exclude<P[key], boolean>] extends [never]
      ? [
          string | (P[key] extends true ? undefined : never),
          Extract<P[key], boolean>,
        ]
      : [
          (
            | _Values[key]
            | (Optionals[key] extends true
                ? Extract<
                    HandleUnknown<
                      Exclude<P[key], boolean>['defaultValue'],
                      undefined
                    >,
                    undefined
                  >
                : never)
          ),
          Extract<HandleUnknown<Optionals[key], false>, boolean>,
        ];
  }>;
};

const param = ((
    param: Record<string, ParamOptions<unknown, unknown, boolean> | boolean>
  ) =>
  (parsers, stringifies, pathParams) => {
    type Options = ParamOptions<unknown, unknown, boolean>;

    const name = Object.keys(param)[0];

    const options = param[name];

    let defaultValue: Options['defaultValue'],
      fallbackValue: Options['fallbackValue'],
      isValid: Options['isValid'],
      optional: Options['optional'],
      parse: Options['parse'],
      stringify: Options['stringify'];

    if (typeof options == 'object') {
      defaultValue = options.defaultValue;
      fallbackValue = options.fallbackValue;
      isValid = options.isValid;
      optional = options.optional;
      parse = options.parse;
      stringify = options.stringify;
    } else {
      optional = options;
    }

    const pattern = `/(?<${name}>[^/]+)`;

    parsers.set(
      name,
      handleParse(name, optional, parse, isValid, defaultValue, fallbackValue)
    );

    stringifies.set(name, handleStringify(stringify, optional, defaultValue));

    pathParams.push(name);

    return optional ? `(?:${pattern})?` : pattern;
  }) as {
  <
    Values extends Record<string, unknown>,
    const Optionals extends { [key in keyof Values]: unknown },
    P extends Record<
      keyof Values,
      | Omit<
          ParamOptions<unknown, unknown, unknown, HandleUnknown<Source, never>>,
          'isValid' | 'stringify'
        >
      | boolean
    >,
    Source,
  >(
    param: IsUnion<keyof P> extends false
      ? P & {
          [key in keyof Values & keyof Optionals]: ParamOptions<
            HandleUnknown<Exclude<Values[key], Function>, string>,
            Optionals[key] extends true
              ? HandleUnknown<Exclude<Values[key], Function>, string>
              : never,
            HandleUnknown<Optionals[key], false>,
            HandleUnknown<Source, never>
          >;
        }
      : never
  ): PathParam<
    {
      [key in keyof Values]: [Exclude<NoInfer<P>[key], boolean>] extends [never]
        ? [
            string | (NoInfer<P>[key] extends true ? undefined : never),
            NoInfer<P>[key],
          ]
        : [
            (
              | HandleUnknown<Exclude<NoInfer<Values>[key], Function>, string>
              | (NoInfer<Optionals>[key] extends true
                  ? Extract<
                      HandleUnknown<
                        Exclude<NoInfer<P>[key], boolean>['defaultValue'],
                        undefined
                      >,
                      undefined
                    >
                  : never)
            ),
            HandleUnknown<NoInfer<Optionals>[key], false>,
          ];
    },
    HandleUnknown<NoInfer<Source>, never>
  >;
};

const handleSegment = (segment: string) => {
  if (segment[0] != '/') {
    segment = '/' + segment;
  }

  const l = segment.length - 1;

  return !l || segment[l] != '/' ? segment : segment.slice(0, l);
};

type CreatePath<Source = never> = {
  <P extends PathParam<Record<string, any>, Source>[]>(
    strings: ReadonlyArray<string>,
    ...params: P
  ): UnionToIntersection<
    { [key in keyof P]: P[key][typeof PATH_PARAM_MARKER] }[number]
  >;
  // <
  //   P extends [
  //     ...params: PathParam<Record<string, any>,Source>[],
  //     query: QueryParam<Record<string, any>,Source>,
  //   ],
  // >(
  //   strings: ReadonlyArray<string>,
  //   ...params: P
  // ): UnionToIntersection<
  //   {
  //     [key in keyof P]: P[key] extends PathParam<Record<string, any>,Source>
  //       ? P[key][typeof PATH_PARAM_MARKER]
  //       : P[key] extends QueryParam<Record<string, any>,Source>
  //         ? P[key][typeof QUERY_PARAM_MARKER]
  //         : never;
  //   }[number]
  // >;
  // <
  //   P extends [
  //     ...params: PathParam<Record<string, any>,Source>[],
  //     children: Record<string, Route>,
  //   ],
  // >(
  //   strings: ReadonlyArray<string>,
  //   ...params: P
  // ): UnionToIntersection<
  //   {
  //     [key in keyof P]: P[key] extends PathParam<Record<string, any>,Source>
  //       ? P[key][typeof PATH_PARAM_MARKER]
  //       : never;
  //   }[number]
  // >;
  // <
  //   P extends [
  //     ...params: PathParam<Record<string, any>,Source>[],
  //     children: Record<string, Route>,
  //     query: QueryParam<Record<string, any>,Source>,
  //   ],
  // >(
  //   strings: ReadonlyArray<string>,
  //   ...params: P
  // ): UnionToIntersection<
  //   {
  //     [key in keyof P]: P[key] extends PathParam<Record<string, any>,Source>
  //       ? P[key][typeof PATH_PARAM_MARKER]
  //       : P[key] extends QueryParam<Record<string, any>,Source>
  //         ? P[key][typeof QUERY_PARAM_MARKER]
  //         : never;
  //   }[number]
  // >;
};

const awdds = null! as CreatePath;

const eee = awdds`/kek/${param({
  kek: {
    parse(value) {
      return 123;
    },
    optional: true,

    defaultValue: 123,

    stringify(value) {
      return 'true';
    },
  },
})}`;

const createRouta: {
  <P extends PathParam<Record<string, any>>[]>(
    strings: ReadonlyArray<string>,
    ...params: P
  ): UnionToIntersection<
    { [key in keyof P]: P[key][typeof PATH_PARAM_MARKER] }[number]
  >;
  <
    P extends [
      ...params: PathParam<Record<string, any>>[],
      query: QueryParam<Record<string, any>>,
    ],
  >(
    strings: ReadonlyArray<string>,
    ...params: P
  ): UnionToIntersection<
    {
      [key in keyof P]: P[key] extends PathParam<Record<string, any>>
        ? P[key][typeof PATH_PARAM_MARKER]
        : P[key] extends QueryParam<Record<string, any>>
          ? P[key][typeof QUERY_PARAM_MARKER]
          : never;
    }[number]
  >;
  <
    P extends [
      ...params: PathParam<Record<string, any>>[],
      children: Record<string, Route>,
    ],
  >(
    strings: ReadonlyArray<string>,
    ...params: P
  ): UnionToIntersection<
    {
      [key in keyof P]: P[key] extends PathParam<Record<string, any>>
        ? P[key][typeof PATH_PARAM_MARKER]
        : never;
    }[number]
  >;
  <
    P extends [
      ...params: PathParam<Record<string, any>>[],
      children: Record<string, Route>,
      query: QueryParam<Record<string, any>>,
    ],
  >(
    strings: ReadonlyArray<string>,
    ...params: P
  ): UnionToIntersection<
    {
      [key in keyof P]: P[key] extends PathParam<Record<string, any>>
        ? P[key][typeof PATH_PARAM_MARKER]
        : P[key] extends QueryParam<Record<string, any>>
          ? P[key][typeof QUERY_PARAM_MARKER]
          : never;
    }[number]
  >;
} = (
  strings: ReadonlyArray<string>,
  ...params: [
    ...PathParam<Record<string, any>>[],
    children: Record<string, Route>,
    query:
      | QueryParamWithReplace<Record<string, any>>
      | Record<string, QueryParamWithReplace<Record<string, any>>>,
  ]
) => {
  const parsers = new Map<string, HandleParse>();

  const stringifies = new Map<string, HandleStringify>();

  const pathParams: string[] = [];

  const queryParams: string[] = [];

  let l = params.length;

  let children: Record<string, Route> | undefined;

  let regexStr = handleSegment(strings[0]);

  if (l) {
    const last = params[l - 1];

    if (typeof last == 'object') {
      l--;

      const keys = Object.keys(last);

      if (typeof last[keys[0]] == 'object') {
        children = last as Record<string, Route>;
      } else {
      }
    } else if ('replace' in last) {
      l--;

      if (l) {
        const prelast = params[l - 1];

        if (typeof prelast == 'object') {
          l--;

          children = prelast as Record<string, Route>;
        }
      }
    }

    for (let i = 0; i < l; i++) {
      regexStr +=
        handleSegment(strings[i]) +
        (params[i] as PathParam<Record<string, any>>)(
          parsers,
          stringifies,
          pathParams
        );
    }
  }

  const lastString = strings[l];

  if (lastString && lastString != '/') {
    regexStr += handleSegment(lastString);
  }
};

createRouta`/kek/${{
  ee: {
    optional: true,
    parse(value) {
      return 123;
    },
  },
}}`;

export default createRoute;
