import identity from 'lodash.identity';
import { ROOT } from '../utils/constants';
import alwaysTrue from '../utils/alwaysTrue';
import alwaysFalse from '../utils/alwaysFalse';
import {
  AsyncControl,
  HandleUnknown,
  IsUnion,
  HandleParse,
  HandleStringify,
  ParamOptions,
  Path,
  PathParam,
  QueryParamWithReplace,
  CreatePath,
  OneOfOptions,
  ArrayOptions,
} from '../types';

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

export const query = ((
  params: Record<string, ParamOptions<unknown, unknown, boolean> | boolean>
) => {
  let deprecatedQuery: (searchParams: Record<string, string>) => boolean =
    alwaysFalse;

  const handleQuery = ((parsers, stringifies, queryParams) => {
    type Options = ParamOptions<unknown, true>;

    for (const name in params) {
      const options = params[name] as Options;

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
    const O extends { [key in keyof Values]: unknown },
    Values extends Record<string, unknown>,
    const P extends Record<keyof Values, any>,
    Source,
  >(
    param: {
      [key in keyof Values & keyof O]: ParamOptions<
        Exclude<HandleUnknown<Values[key], string>, Function>,
        HandleUnknown<O[key], false>,
        HandleUnknown<Source, never>
      >;
    } & P
  ): ValidateParams<P> &
    QueryParamWithReplace<
      {
        [key in keyof P]: P[key] extends boolean
          ? [string | (P[key] extends true ? undefined : never), P[key]]
          : P[key] extends ParamOptions<
                infer V,
                infer O,
                HandleUnknown<Source, never>
              >
            ? [
                (
                  | HandleUnknown<V, string>
                  | (O extends true
                      ? P[key] extends { defaultValue: infer K }
                        ? Extract<K extends () => infer K ? K : K, undefined>
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

export const oneOf = ((param: Record<string, OneOfOptions<string[], true>>) =>
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

export const array = ((param: Record<string, ArrayOptions<any> | false>) =>
  (parsers, stringifies, pathParams, path) => {
    const name = Object.keys(param)[0];

    const options = param[name];

    const parse = (options && options.parse) || identity;

    const stringify = options && options.stringify;

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

export const param = ((
    param: Record<string, ParamOptions<unknown, unknown, boolean> | boolean>
  ) =>
  (parsers, stringifies, pathParams, path) => {
    type Options = ParamOptions<unknown, true>;

    const name = Object.keys(param)[0];

    const options = param[name] as Options | boolean;

    const pattern = `/(?<${name}>[^/]+)`;

    let defaultValue: Options['defaultValue'],
      fallbackValue: Options['fallbackValue'],
      isValid: Options['isValid'],
      optional: boolean | undefined,
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

    pathParams.push(name);

    path.push(name);

    return optional ? `(?:${pattern})?` : pattern;
  }) as {
  <
    const O extends { [key in keyof Values]: unknown },
    Values extends Record<string, unknown>,
    const P extends Record<keyof Values, any>,
    Source,
  >(
    param: {
      [key in keyof Values & keyof O]: ParamOptions<
        Exclude<HandleUnknown<Values[key], string>, Function>,
        HandleUnknown<O[key], false>,
        HandleUnknown<Source, never>
      >;
    } & P
  ): (IsUnion<keyof P> extends false ? ValidateParams<P> : never) &
    PathParam<
      {
        [key in keyof P]: P[key] extends boolean
          ? [string | (P[key] extends true ? undefined : never), P[key]]
          : P[key] extends ParamOptions<
                infer V,
                infer O,
                HandleUnknown<Source, never>
              >
            ? [
                (
                  | HandleUnknown<V, string>
                  | (O extends true
                      ? P[key] extends { defaultValue: infer K }
                        ? Extract<K extends () => infer K ? K : K, undefined>
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

type ValidateParams<P> = keyof P extends {
  [key in keyof P]: P[key] extends boolean | ParamOptions<any, any, any>
    ? key
    : never;
}[keyof P]
  ? unknown
  : never;

const handleSegment = (segment: string, path: string[]) => {
  segment = `/${segment}`;

  const l = path.length;

  if (l && path[l - 1][0] == '/') {
    path[l - 1] += segment;
  } else {
    path.push(segment);
  }

  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const handlePath = (
  path: Array<
    | string
    | PathParam<Record<string, any>>
    | Record<string, Path>
    | QueryParamWithReplace<Record<string, any>>
  >,
  source?: AsyncControl
): Path => {
  const parsers = new Map<string, HandleParse>();

  const stringifies = new Map<string, HandleStringify>();

  const _path: string[] = [];

  const pathParams: string[] = [];

  const queryParams: string[] = [];

  const l = path.length - 2;

  let children: Record<string, Path> | undefined;

  let regexStr = '';

  let replaceDeprecatedQueryParams: Path['_replaceDeprecatedQueryParams'] =
    alwaysFalse;

  if (l > -2) {
    if (l > -1) {
      for (let i = 0; i < l; i++) {
        let segment = path[i] as string | PathParam<Record<string, any>>;

        regexStr +=
          typeof segment == 'string'
            ? handleSegment(segment, _path)
            : segment(parsers, stringifies, pathParams, _path);
      }

      const penultimate = path[l];

      if (typeof penultimate == 'string') {
        regexStr += handleSegment(penultimate, _path);
      } else if (penultimate.length == 4) {
        regexStr += (penultimate as PathParam<{}>)(
          parsers,
          stringifies,
          pathParams,
          _path
        );
      } else {
        replaceDeprecatedQueryParams = (
          penultimate as QueryParamWithReplace<{}>
        )(parsers, stringifies, queryParams);
      }
    }

    const last = path[l + 1];

    if (typeof last == 'object') {
      children = last;
    } else if (typeof last == 'string') {
      regexStr += handleSegment(last, _path);
    } else if (last.length == 4) {
      regexStr += (last as PathParam<{}>)(
        parsers,
        stringifies,
        pathParams,
        _path
      );
    } else {
      replaceDeprecatedQueryParams = (last as QueryParamWithReplace<{}>)(
        parsers,
        stringifies,
        queryParams
      );
    }
  }

  return {
    _regexStr: regexStr,
    _children: children,
    _getParse: parsers.get.bind(parsers),
    _getStringify: stringifies.get.bind(stringifies),
    _replaceDeprecatedQueryParams: replaceDeprecatedQueryParams,
    _pathParams: pathParams,
    _queryParams: queryParams,
    _path,
    _source: source && source[ROOT],
  } as Path;
};

export const createAsyncPath: {
  <S>(source: AsyncControl<S>): CreatePath<S>;
} =
  (source) =>
  (
    ...path: Array<
      | string
      | PathParam<Record<string, any>>
      | Record<string, Path>
      | QueryParamWithReplace<Record<string, any>>
    >
  ): any =>
    handlePath(path, source);

export const createPath: CreatePath = (
  ...path: Array<
    | string
    | PathParam<Record<string, any>>
    | Record<string, Path>
    | QueryParamWithReplace<Record<string, any>>
  >
): any => handlePath(path);
