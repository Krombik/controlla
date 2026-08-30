import type { ReactNode, RefCallback } from 'react';

import type {
  Control,
  ControlScope,
  ReadonlyControl,
  ReadonlyControlScope,
  SelectValue,
} from '#types';

/**
 * What a field's `ref` needs of whatever renders it - an `HTMLElement`, a
 * `TextInput` and a handle a component hands out in place of either all
 * qualify. A failed submit orders what it can read a document position off
 * of; the rest keeps the order it registered in.
 */
export type FieldElement = { focus(): void };

/** Just enough of a submit event to know where it came from and to stop it. */
export type SubmitLike = { type: string; preventDefault(): void };

/** When a validator runs on its own, outside of a submit sweep. */
export type ValidateOn = 'submit' | 'change' | 'blur';

type Combine<
  Item extends string | number,
  Prefix extends string,
> = Prefix extends '' ? `${Item}` : `${Prefix}.${Item}`;

/** Whatever keys these carry, an error over one belongs to the whole thing. */
type Leaf =
  Function | Date | RegExp | File | FileList | Map<any, any> | Set<any>;

/**
 * Every dot path under {@link T}, the branches as well as the leaves — what a
 * `PATCH` names and what a path validator keys its errors by. An array indexes
 * as `${number}`, since which index is meant isn't known here.
 */
export type KeysOf<T, Prefix extends string = ''> =
  // `any` takes both sides of every branch below, which never stops recursing
  0 extends 1 & T
    ? string
    : T extends Leaf
      ? never
      : T extends readonly (infer Item)[]
        ? Combine<number, Prefix> | KeysOf<Item, Combine<number, Prefix>>
        : T extends object
          ? {
              // an optional key would otherwise add `undefined` to the union
              [Key in keyof T & (string | number)]-?:
                Combine<Key, Prefix> | KeysOf<T[Key], Combine<Key, Prefix>>;
            }[keyof T & (string | number)]
          : never;

/** What a validator answers with — `undefined` while the value passes. */
export type Validate<V, E> = (
  value: V
) => E | undefined | Promise<E | undefined>;

/** One slot per control, each holding that control's own error. */
export type ErrorsOf<C extends readonly Control[], E> = {
  -readonly [Key in keyof C]: E | undefined;
};

/** The tuple form: it gets every value, and answers for every control. */
export type ValidateAll<C extends readonly Control[], E> = (values: {
  -readonly [Key in keyof C]: SelectValue<C[Key]>;
}) => ErrorsOf<C, E> | undefined | Promise<ErrorsOf<C, E> | undefined>;

/**
 * One control and what is wrong with it - what a rule reports for each control
 * it names. Both halves are inferred per pair, so a rule answering with a
 * different error for a different kind of control keeps the two apart.
 */
export type ControlError<
  C extends ReadonlyControl = ReadonlyControl,
  E = any,
> = [control: C, error: E];

/**
 * One error per control, all of them the same shape - the annotation an
 * accumulator needs, since an array literal built by pushing widens away from a
 * tuple. Pairs of their own shapes are an array of {@link ControlError}s.
 *
 * @example
 * ```ts
 * const errors: ControlErrors<string> = [];
 *
 * errors.push([$values.emails[i], 'duplicate']);
 * ```
 */
export type ControlErrors<E = any> = Array<ControlError<Control, E>>;

export type ValidateControls<V, E extends ControlError> = (
  value: V
) => E[] | undefined | Promise<E[] | undefined>;

/** Every pair of a rule as a signature of its own, the way overloads read. */
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;

/**
 * Reads the error a validator reported for one control - `undefined` while it
 * reported none, typed to whatever that control was paired with. The control is
 * created on first ask and kept, so nothing is allocated for a field whose
 * error nothing renders.
 */
export type ErrorOf<E extends ControlError> = UnionToIntersection<
  E extends any
    ? (control: E[0]) => ReadonlyControlScope<E[1] | undefined>
    : never
>;

export type FormOptions<T = any> = {
  /**
   * Runs once every validator passed, with the form control's value. A submit
   * leaves the baseline where it is - call `reset(control, values)` from here
   * to make what was sent the new one.
   *
   * {@link changed} lists the fields that moved since the baseline, as
   * dot-joined paths relative to the form control - what a `PATCH` would send.
   * Leave the parameter out and nothing is collected for it.
   */
  submit(values: T, changed: Array<KeysOf<T>>): void | Promise<void>;
  /**
   * Runs instead of {@link FormOptions.submit submit} when a validator failed,
   * after the first invalid field is focused - to scroll somewhere, or report
   * the failure. What failed is in the error controls the validators returned.
   */
  submitFailed?(): void | Promise<void>;
  /** Default {@link ValidateOn trigger} of the validators under the form (default: `'submit'`). */
  validateOn?: ValidateOn;
};

/** The form handle — what `useForm` creates and `useFormState` reads back. */
export type FormState = {
  /** `true` while a submit is in flight, across the validator sweep and the submit handler. */
  readonly $isSubmitting: ReadonlyControl<boolean>;
  /** `true` while any validator has an async check in flight. */
  readonly $isValidating: ReadonlyControl<boolean>;
  /** `true` while no validator holds an error — one that never ran counts as valid. */
  readonly $isValid: ReadonlyControl<boolean>;
  /** `true` while anything has been edited since it was last reset. */
  readonly $isDirty: ReadonlyControl<boolean>;
  /**
   * Runs every validator and, if all passed, the
   * {@link FormOptions.submit submit} handler. Ignores the call while another
   * submit is in flight, and calls `preventDefault` on a submit
   * {@link event} — so it's usable directly as a `<form onSubmit>`, and as a
   * button's `onClick` without swallowing what the button would have done.
   */
  submit(event?: SubmitLike): Promise<void>;
  /** Runs every validator, resolving to whether all of them passed. */
  validate(): Promise<boolean>;
  /**
   * Puts the values back to the baseline - everything, or one control, a path
   * with no field on it included. Given a value as well, writes that and makes
   * it the baseline instead - not before the form has one, since over an async
   * control the first value a load hands over is it. Either way the validators
   * it covers forget what they held.
   */
  reset: {
    (): void;
    (control: Control): void;
    <C extends Control>(control: C, value: SelectValue<C>): void;
  };
  /**
   * Focuses the field's element - the one a server error named, the first one
   * of a step. Answers whether there was anything to focus: a field is only
   * focusable once it's mounted and its `ref` was passed on to an element.
   */
  focus(control: Control): boolean;
};

/** The reactive state of a single field, keyed by its control. */
export type FieldState<C extends ReadonlyControl = ReadonlyControl> = {
  /** The control this state belongs to, so `render` needs no closure. */
  readonly $field: C;
  /**
   * Whether a validator holds an error for this exact control. What the error
   * *is* lives in the control its validator returned - an error goes neither
   * up nor down the tree, so a field is red for its own path only.
   */
  readonly $isError: ReadonlyControl<boolean>;
  /**
   * Whether this field has been edited since it was last reset. Stays `false`
   * for a field over a control the form is not over.
   */
  readonly $isDirty: ReadonlyControl<boolean>;
  /** Whether an async validator covering this field is in flight. */
  readonly $isValidating: ReadonlyControl<boolean>;
};

/** The keys and the operations `useFieldArray` gives an array control. */
export type FieldArray<T> = {
  /**
   * One key per item, in order — for React's `key`, and nothing else. It
   * changes only when the items do, so a rewrite of one row's value doesn't
   * re-render the list around it.
   */
  readonly $keys: ReadonlyControl<number[]>;
  /** Adds {@link value} to the end. */
  append(value: T): void;
  /** Adds {@link value} to the front. */
  prepend(value: T): void;
  /** Adds {@link value} at {@link index}, pushing the rest back. An index past the end appends. */
  insert(index: number, value: T): void;
  /**
   * The three above for items you already hold as an array — a paste, a
   * multi-select, a fetched page. One call, so one commit and one render:
   * `values.forEach(append)` would key and write the array once per item.
   */
  appendMany(values: readonly T[]): void;
  prependMany(values: readonly T[]): void;
  insertMany(index: number, values: readonly T[]): void;
  /**
   * Drops {@link count} items from {@link index} on (default: one). A count
   * past the end drops what is left of the array.
   */
  remove(index: number, count?: number): void;
  /**
   * Drops the items at {@link indexes} - scattered, in any order, what a
   * multi-select gives you. Duplicates and indexes past the end are ignored.
   * Safer than `remove` in a loop, which shifts the indexes as it goes.
   */
  removeMany(indexes: readonly number[]): void;
  /**
   * Swaps the whole array out — every item gets a new key, so every row
   * remounts. Takes the array itself rather than a list of items: replacing is
   * what you do with one you already have.
   */
  replace(values: T[]): void;
  swap(a: number, b: number): void;
  /** Moves the item at {@link from} to the index {@link to} of the result. */
  move(from: number, to: number): void;
};

/** The wiring a field hands to whatever renders it. */
export type FieldRenderProps<V = any> = {
  /** The control's path, dot-joined — `undefined` for a root control. */
  name: string | undefined;
  /** Attach it for `focus` and for a failed submit to reach this field. */
  ref: RefCallback<FieldElement>;
  onBlur?(): void;
  value: V;
  /** Writes the value - a plain value, not an event. */
  onChange(value: V): void;
  /** Whether a validator holds an error for this field. */
  isError: boolean;
};

export type FieldProps<C extends Control = Control> = {
  control: C;
  /**
   * Called with the value the field just wrote. Anything it sets is committed
   * together with that value, in one render.
   */
  onChange?(value: SelectValue<C>): void;
  /**
   * For a **router params** control: replace the current history entry rather
   * than push one, the way `replaceValue` does - a field otherwise leaves a
   * history entry per keystroke. Does nothing on any other control.
   */
  replace?: boolean;
  render(
    props: FieldRenderProps<SelectValue<C>>,
    state: FieldState<C>
  ): ReactNode;
};

/**
 * What a field is, rather than which element renders it: `NativeField` maps
 * it to the attributes that behave best today. `'numeric'`/`'decimal'` and
 * `'email'` render as `text` with an `inputmode` — the two native types with
 * no text cursor, no way to restore a caret, and validation of their own.
 */
export type NativeFieldType =
  | 'text'
  | 'search'
  | 'url'
  | 'tel'
  | 'password'
  | 'color'
  | 'hidden'
  | 'email'
  | 'numeric'
  | 'decimal'
  | 'range'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'date'
  | 'month'
  | 'week'
  | 'time'
  | 'datetime-local'
  | 'textarea'
  | 'select'
  | 'multiselect';

/**
 * The value a {@link NativeFieldType type} reads and writes. A date input
 * holds the string the element itself holds — it round-trips exactly, carries
 * no timezone, and serializes; converting to a `Date` is a decision only the
 * app can make, so it makes it.
 */
export type NativeValue<T extends NativeFieldType> = T extends 'checkbox'
  ? boolean
  : T extends 'numeric' | 'decimal' | 'range'
    ? number
    : T extends 'file'
      ? FileList | null
      : T extends 'multiselect'
        ? string[]
        : string;

/** The element a {@link NativeFieldType type} has to be attached to. */
export type NativeElement<T extends NativeFieldType> = T extends 'textarea'
  ? HTMLTextAreaElement
  : T extends 'select' | 'multiselect'
    ? HTMLSelectElement
    : HTMLInputElement;

type CommonNativeProps<T extends NativeFieldType> = {
  /** The control's path, dot-joined — `undefined` for a root control. */
  name: string | undefined;
  /**
   * Wires the element up, both ways. Typed to the element this
   * {@link NativeFieldType type} belongs on, so attaching it to the wrong tag
   * doesn't compile.
   */
  ref: RefCallback<NativeElement<T>>;
  onBlur?(): void;
};

export type NativeFieldRenderProps<T extends NativeFieldType> =
  CommonNativeProps<T> &
    (T extends 'textarea'
      ? {}
      : T extends 'select' | 'multiselect'
        ? { multiple?: boolean }
        : {
            type: string;
            inputMode?: 'numeric' | 'decimal' | 'email';
            autoCapitalize?: 'none';
            autoCorrect?: 'off';
            spellCheck?: false;
            defaultChecked?: boolean;
          });

/**
 * Rejects a control that can't hold everything the field may write. The brand
 * `Control` carries its value in is covariant, so a `Control<string>` passes
 * for a `Control<string | undefined>` on its own, and the field would write a
 * value the rest of the app reads as impossible.
 */
export type ExactControl<T extends NativeFieldType, C extends Control> =
  NativeValue<T> extends SelectValue<C>
    ? unknown
    : { control: 'the control has to hold every value this field can write' };

/**
 * Converts the value on its way between the element and the control, both
 * ways. Not a mask - reflowing separators while someone types moves the caret
 * about, which needs a component of its own.
 */
export type NativeFieldConverters<
  T extends NativeFieldType,
  C extends Control,
> = {
  /** Turns what the element holds into what the control holds. */
  parse(value: NativeValue<T>): SelectValue<C>;
  /**
   * Turns it back for the writes the element didn't make - a `reset`, data
   * arriving. Needed once {@link NativeFieldConverters.parse parse} changes
   * the type.
   */
  format?(value: SelectValue<C>): NativeValue<T>;
};

export type NativeFieldOptions<
  T extends NativeFieldType = NativeFieldType,
  C extends Control = Control,
> = {
  type: T;
  /**
   * The id of the element showing the error, pointed at while there is one.
   * That describes the field to a screen reader on focus - to have an error
   * announced as it appears, put `role='alert'` on that element too.
   */
  errorId?: string;
  /**
   * Whatever else describes the field — a hint, a format note — as one or more
   * ids. The field owns the element's `aria-describedby` and composes this
   * with {@link NativeFieldOptions.errorId errorId}, so pass ids here rather
   * than setting the attribute yourself: React would overwrite it.
   */
  describedBy?: string;
  /**
   * Called with the value the field just wrote — parsed, as the control holds
   * it. Anything it sets is committed together with that value, in one render.
   */
  onChange?(value: SelectValue<C>): void;
  /**
   * For a **router params** control: replace the current history entry rather
   * than push one, the way `replaceValue` does - a field otherwise leaves a
   * history entry per keystroke. Does nothing on any other control.
   */
  replace?: boolean;
} & Partial<NativeFieldConverters<T, C>>;

export type NativeFieldProps<
  T extends NativeFieldType = NativeFieldType,
  C extends Control = Control,
> = NativeFieldOptions<T, C> & {
  control: C;
  render(props: NativeFieldRenderProps<T>, state: FieldState<C>): ReactNode;
};

export type ValidatorProps<C extends Control = Control, E = any> = {
  control: C;
  validate: Validate<SelectValue<C>, E>;
  validateOn?: ValidateOn;
  render?(error: ControlScope<E | undefined>): ReactNode;
};

export type ValidatorAllProps<
  C extends readonly Control[] = readonly Control[],
  E = any,
> = {
  controls: C;
  validate: ValidateAll<C, E>;
  validateOn?: ValidateOn;
  render?(errors: { [Key in keyof C]: ControlScope<E | undefined> }): ReactNode;
};

export type PathValidatorProps<
  C extends Control,
  E extends ControlError = ControlError,
> = {
  control: C;
  validate: ValidateControls<SelectValue<C>, E>;
  validateOn?: ValidateOn;
  render?(errorOf: ErrorOf<E>): ReactNode;
};
