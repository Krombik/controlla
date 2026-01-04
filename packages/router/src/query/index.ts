import alwaysFalse from '@react-control/core/_shared/alwaysFalse';
import handleParse from '#utils/handleParse';
import handleStringify from '#utils/handleStringify';
import type {
  HandleUnknown,
  ParamOptions,
  QueryParamWithReplace,
  ValidateParams,
} from '#_types';

const query = ((
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

export default query;
