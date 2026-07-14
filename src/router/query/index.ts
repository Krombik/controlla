import handleParse from '#router/internal/handleParse';
import handleStringify from '#router/internal/handleStringify';
import type {
  HandleUnknown,
  ParamOptions,
  QueryParam,
  ValidateParams,
} from '#router/internal/types';

const query = ((
    params: Record<string, ParamOptions<unknown, unknown, boolean> | boolean>
  ) =>
  (parsers, stringifies, queryParams) => {
    type Options = ParamOptions<unknown, true, any>;

    const keys = Object.keys(params);

    for (let i = 0, l = keys.length; i < l; i++) {
      const name = keys[i];

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

      parsers[name] = handleParse(
        name,
        optional,
        parse,
        isValid,
        defaultValue,
        fallbackValue
      );

      stringifies[name] = handleStringify(stringify, optional, defaultValue);

      queryParams.push(name);
    }
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
    QueryParam<
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
