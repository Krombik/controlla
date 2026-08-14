import type { ReactNode, RefCallback, SubmitEvent } from 'react';

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
   * Runs once every registered validator passed, with the form control's
   * value. What it was given becomes the new baseline once it resolves, so a
   * saved form isn't dirty — and an edit made while it was in flight still is.
   *
   * {@link changed} carries the paths of the fields differing from that
   * baseline, dot-joined and relative to the form control — what a `PATCH`
   * would send. Since each submit rebaselines, an autosaving form gets what
   * moved since the *previous* submit, not since the page loaded.
   *
   * Only fields under the form control are in it: a field over some other
   * control isn't in {@link values} either, so there'd be nothing to patch.
   * Nothing is collected for a handler that doesn't declare the parameter — so
   * a rest signature gets an empty array.
   */
  submit(values: T, changed: Array<KeysOf<T>>): void | Promise<void>;
  /**
   * Runs instead of {@link FormOptions.submit submit} when the sweep found
   * errors — after the first invalid field is focused, so it can scroll
   * somewhere else or report the failure.
   */
  submitFailed?(errors: Array<FieldError<E>>): void | Promise<void>;
  /** Default {@link ValidateOn trigger} of the fields under the form (default: `'submit'`). */
  validateOn?: ValidateOn;
  /**
   * Where a `reset` with no value of its own goes, instead of the value the
   * form started with — filters restored from the url start there and reset to
   * empty, not back to the url. It becomes the new baseline, like any other
   * `reset` to a given value.
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
  /**
   * `true` while any field's value differs from its baseline - which a
   * successful submit, a `reset` and, over an async control, every value a load
   * brings back all move.
   */
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
   * Without arguments, restores the whole form. Given a control, restores
   * just it — any control the form has a baseline for, including a path no
   * field is mounted on. Given a value as well, writes that instead, and it
   * becomes the new baseline.
   *
   * What "restores" means is the baseline, or
   * {@link FormOptions.resetValue resetValue} where the form was given one.
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
  /** The control this state belongs to, echoed back so `render` can stay closure-free. */
  readonly $field: C;
  /** The current validation error, `undefined` while the field passes (or never ran). */
  readonly $error: ReadonlyControl<E | undefined>;
  /**
   * Whether the value differs from the baseline - which a successful submit, a
   * `reset` to a value of its own, and a reload of the control it sits on all
   * move, so this clears on a save without the value having to move back.
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
   * Drops the items at {@link indexes}, which need not be neighbours — what a
   * multi-select gives you. In any order; duplicates and indexes past the end
   * are ignored.
   *
   * Not `remove` in a loop: each of those shifts the items after it, so the
   * second index would no longer mean the item it was read from.
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
  onBlur?(): void;
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
 * Sits between the element and the control, in both directions — a
 * normalizing pass the field applies for you rather than one you bolt on with
 * a derived control.
 *
 * It does not amount to a mask. Reflowing separators as the value is typed
 * moves characters the caret is measured against, and only code that knows
 * which of them carry meaning can put the caret back — so that belongs in a
 * component of its own.
 */
export type NativeFieldConverters<
  T extends NativeFieldType,
  C extends Control,
> = {
  /** Turns what the element holds into what the control holds. */
  parse(value: NativeValue<T>): SelectValue<C>;
  /**
   * Turns it back, for the writes the element didn't cause — a `reset`, an
   * async fill. Needed once {@link NativeFieldConverters.parse parse} changes
   * the type; without it the control's value is written as it is.
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
   * Commits what the element writes through this
   * {@link Scheduler scheduler} rather than the default flush — a
   * `createDebounceScheduler(300)` on a text filter and nothing on the
   * checkbox beside it, so each applies at its own pace.
   *
   * The element keeps showing what was typed the whole time; only the commit
   * waits. Anything downstream of the control — validation on change, dirty,
   * a submit watching it — waits with it. A form with a submit button
   * shouldn't use it: the button can be clicked while a write is still
   * pending, and the submit would carry the value from before it.
   */
  scheduler?: Scheduler;
  /**
   * The id of the node rendering the error, pointed at while the field holds
   * one.
   *
   * `aria-describedby` describes the field once it has focus; it doesn't
   * announce. An error that should interrupt needs `role='alert'` on the node
   * rendering it, which is yours.
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
