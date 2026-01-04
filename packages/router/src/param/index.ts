import handleParse from '#utils/handleParse';
import handleStringify from '#utils/handleStringify';
import type {
  HandleUnknown,
  IsUnion,
  ParamOptions,
  PathParam,
  ValidateParams,
} from '#_types';

const param = ((
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

export default param;
