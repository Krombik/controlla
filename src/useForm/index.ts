// import { BaseSyntheticEvent } from 'react';
// import { Control, ControlScope } from '../types';

// const $each = '$each';
// const $self = '$self';

// type ProcessValue<T, R> =
//   | ((value: T, root: R) => any)
//   | ({ [$self]?(value: T, root: R): any } & (T extends any[]
//       ? [Exclude<keyof T, keyof []>] extends [never]
//         ?
//             | { [$each]: ProcessValue<T[number], R> }
//             | ({ [$each]?: undefined } & Record<
//                 number,
//                 ProcessValue<T[number], R>
//               >)
//         : {
//             [key in keyof T as key extends `${number}`
//               ? key
//               : never]?: ProcessValue<T[key], R>;
//           }
//       : T extends Record<string, any>
//         ? { [key in keyof T]?: ProcessValue<T[key], R> }
//         : never));

// type ErrorsOf<T> = T extends (...args: any[]) => infer K
//   ? [Extract<K, false | undefined>] extends [never]
//     ? K
//     : Exclude<K, false> | undefined
//   : T extends Record<string, any>
//     ? typeof $each extends keyof T
//       ? ErrorsOf<T[typeof $each]>[]
//       : { [key in keyof T]: ErrorsOf<T[key]> }
//     : never;

// const useForm = <
//   T extends Record<string, any>,
//   E extends { [key in keyof T]?: ProcessValue<T[key], T> } | {},
// >(
//   options: {
//     defaultValue: () => T;
//     validationSchema?: () => E;
//     onSubmit(value: T): void | Promise<void>;
//   } & ([keyof E] extends [never]
//     ? {}
//     : {
//         validateOn?: 'submit' | 'blur' | 'change';
//         onInvalidSubmit?(value: T): void | Promise<void>;
//       })
// ): {
//   readonly fields: ControlScope<T>;
//   readonly isSubmitting: Control<boolean>;
//   handleSubmit(e?: BaseSyntheticEvent): Promise<void>;
// } & ([keyof E] extends [never]
//   ? {}
//   : {
//       readonly errors: ControlScope<Partial<ErrorsOf<E>>>;
//     }) => {
//   return null!;
// };

// useForm({
//   defaultValue: () => ({ a: { c: 123, b: [123, 25] }, w: '' }),
//   validationSchema: () => ({
//     a: { c: (value, b) => value > 5 && 'kek', b: { $each: (v) => 'bek' } },
//   }),
//   onSubmit(value) {},
// }).errors;

// export default useForm;
