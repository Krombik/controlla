import type { FocusEvent, ReactNode, RefCallback, SubmitEvent } from 'react';

import type { Control, ReadonlyControl, Scheduler, SelectValue } from '#types';

/** When a field's validator runs on its own, outside of a submit sweep. */
export type ValidateOn = 'submit' | 'change' | 'blur';

/** A field holding an error when a submit gave up. */
export type FieldError<E = any> = {
  control: Control;
  error: E;
};

type Combine<
  Item extends string | number,
  Prefix extends string,
> = Prefix extends '' ? `${Item}` : `${Prefix}.${Item}`;

/** Whatever keys these carry, a field over one holds the whole thing. */
type Leaf =
  Function | Date | RegExp | File | FileList | Map<any, any> | Set<any>;

/**
 * Every dot path under {@link T}, the branches as well as the leaves — a field
 * sits on either. An array indexes as `${number}`, since which index a patch
 * carries isn't known here.
 */
type KeysOf<T, Prefix extends string = ''> =
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

export type FormOptions<T = any, E = any> = {
  /**
   * Runs once every validator passed, with the form control's value. Once it
   * resolves the form counts as saved, so it stops being dirty - though an
   * edit made while it was still running stays.
   *
   * {@link changed} lists the fields that moved since the last save, as
   * dot-joined paths relative to the form control - what a `PATCH` would send.
   * Leave the parameter out and nothing is collected for it.
   */
  submit(values: T, changed: Array<KeysOf<T>>): void | Promise<void>;
  /**
   * Runs instead of {@link FormOptions.submit submit} when a validator failed,
   * after the first invalid field is focused - to scroll somewhere, or report
   * the failure.
   */
  submitFailed?(errors: Array<FieldError<E>>): void | Promise<void>;
  /** Default {@link ValidateOn trigger} of the fields under the form (default: `'submit'`). */
  validateOn?: ValidateOn;
  /**
   * Where `reset` goes instead of the values the form started with - filters
   * restored from the url reset to empty rather than back to the url.
   */
  resetValue?: T;
};

/** The form handle — what `useForm` creates and `useFormState` reads back. */
export type FormState = {
  /** `true` while a submit is in flight, across the validator sweep and the submit handler. */
  readonly $isSubmitting: ReadonlyControl<boolean>;
  /** `true` while any field has an async validation in flight. */
  readonly $isValidating: ReadonlyControl<boolean>;
  /** `true` while no field holds an error — a field that never validated counts as valid. */
  readonly $isValid: ReadonlyControl<boolean>;
  /** `true` while anything has been edited since it was last saved or reset. */
  readonly $isDirty: ReadonlyControl<boolean>;
  /**
   * Runs every validator and, if all passed, the
   * {@link FormOptions.submit submit} handler. Ignores the call while another
   * submit is in flight, and calls `preventDefault` on a submit
   * {@link event} — so it's usable directly as a `<form onSubmit>`, and as a
   * button's `onClick` without swallowing what the button would have done.
   */
  submit(
    event?: Pick<SubmitEvent<HTMLFormElement>, 'type' | 'preventDefault'>
  ): Promise<void>;
  /** Runs every validator, resolving to whether all of them passed. */
  validate(): Promise<boolean>;
  /**
   * Puts the values back to what they were saved as, or to
   * {@link FormOptions.resetValue resetValue} if the form was given one.
   * Restores everything, or one control - a path with no field on it included.
   * Given a value as well, writes that and treats it as saved.
   */
  reset: {
    (): void;
    (control: Control): void;
    <C extends Control>(control: C, value: SelectValue<C>): void;
  };
  /** Sets an error on a field from outside its validator — a rejection coming back from the server. */
  setError(control: Control, error: any): void;
};

/** The reactive state of a single field, keyed by its control. */
export type FieldState<C extends ReadonlyControl = ReadonlyControl, E = any> = {
  /** The control this state belongs to, so `render` needs no closure. */
  readonly $field: C;
  /** The current validation error, `undefined` while the field passes (or never ran). */
  readonly $error: ReadonlyControl<E | undefined>;
  /**
   * Whether this field has been edited since it was last saved or reset - a
   * save clears it without the value having to change back.
   */
  readonly $isDirty: ReadonlyControl<boolean>;
  /** Whether an async validation of this field is in flight. */
  readonly $isValidating: ReadonlyControl<boolean>;
};

export type FieldArrayOptions<V = any, E = any> = {
  /**
   * Validates the array as one thing — its length, or its items against each
   * other. What no field of a single item can answer.
   */
  validate?(items: V): E | undefined | Promise<E | undefined>;
  /**
   * Overrides the form's {@link ValidateOn trigger}. `'blur'` has nothing to
   * fire it here — an array holds no element to leave.
   */
  validateOn?: ValidateOn;
};

/**
 * What an array validated by {@link FieldArrayOptions options} carries on top
 * of the structure — an array left unvalidated registers no field, so there is
 * nothing that could hold an error.
 */
export type ValidatedFieldArray<E = any> = {
  /**
   * The error from {@link FieldArrayOptions.validate validate}, `undefined`
   * while the array passes. The rest of the array's field state — its
   * dirtiness, an async validation in flight — is `useFieldState` over the same
   * control, since it's an ordinary registered field.
   */
  readonly $error: ReadonlyControl<E | undefined>;
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

export type FieldRenderProps = {
  /** The control's path, dot-joined — `undefined` for a root control. */
  name: string | undefined;
  /** Attach it for `submit` to focus this field when it's the first invalid one. */
  ref: RefCallback<HTMLElement>;
  /** Only there for a field that validates on blur — nothing listens otherwise. */
  onBlur?(event: FocusEvent<HTMLElement>): void;
};

type FieldOptions<C extends Control, E> = {
  control: C;
  /** Returns the error for an invalid {@link value}, or `undefined` — a promise for an async check. */
  validate?(value: SelectValue<C>): E | undefined | Promise<E | undefined>;
  /** Overrides the form's {@link ValidateOn trigger} for this field. */
  validateOn?: ValidateOn;
  /** Keeps the field registered after unmount — for a step of a wizard that shouldn't un-validate. */
  keepValidator?: boolean;
};

export type FieldProps<C extends Control = Control, E = any> = FieldOptions<
  C,
  E
> & {
  render(props: FieldRenderProps, state: FieldState<C, E>): ReactNode;
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
  /** Only there for a field that validates on blur — nothing listens otherwise. */
  onBlur?(event: FocusEvent<NativeElement<T>>): void;
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

export type NativeFieldProps<
  T extends NativeFieldType = NativeFieldType,
  C extends Control = Control,
  E = any,
> = FieldOptions<C, E> & {
  type: T;
  /**
   * Applies what the element writes through this {@link Scheduler scheduler} -
   * a `createDebounceScheduler(300)` on a search box, nothing on the checkbox
   * beside it. Typing shows up instantly either way; only the value waits, and
   * so does everything reading it. Don't use it with a submit button, which
   * could be clicked while a write is still pending.
   */
  scheduler?: Scheduler;
  /**
   * The id of the element showing the error, pointed at while there is one.
   * That describes the field to a screen reader on focus - to have an error
   * announced as it appears, put `role='alert'` on that element too.
   */
  errorId?: string;
  /**
   * Whatever else describes the field — a hint, a format note — as one or more
   * ids. The field owns the element's `aria-describedby` and composes this
   * with {@link NativeFieldProps.errorId errorId}, so pass ids here rather
   * than setting the attribute yourself: React would overwrite it.
   */
  describedBy?: string;
  render(props: NativeFieldRenderProps<T>, state: FieldState<C, E>): ReactNode;
};
