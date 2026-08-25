import type { Control } from '#types';
import type {
  FieldState,
  FormOptions,
  FormState,
  ValidateOn,
} from '#form/types';

/** The elements `useNativeField` knows how to read and write. */
export type FieldElement =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * How one kind of native element is read, written and declared - the whole
 * per-type dispatch, resolved once from the field's `type`.
 *
 * @internal
 */
export type NativeKind<E extends FieldElement = FieldElement> = {
  _read(element: E): any;
  _write(element: E, value: any): void;
  /** The element attributes this kind implies, merged into the render props. */
  _attrs: Record<string, string | boolean | undefined> | undefined;
  /** Guards `beforeinput` against a value this kind couldn't read back. */
  _filter: ((e: InputEvent) => void) | undefined;
};

/**
 * One `useValidator`/`usePathValidator` call. It owns the error it wrote last,
 * so releasing it takes that error with it.
 *
 * @internal
 */
export type ValidatorInternals = {
  readonly _form: FormInternals;
  /** What it validates - one control, unless it was given a tuple of them. */
  readonly _controls: readonly Control[];
  /** Whether the error answers per control rather than for the one control. */
  readonly _tuple?: boolean;
  /** Whether it answers with an error per control it names, rather than for its own. */
  readonly _paths?: true;
  _validate(value: any): any;
  _mode: ValidateOn;
  /** Where the error lands, and what the hook handed back - not for `_paths`. */
  readonly _errorControl?: Control;
  /** One per control for the tuple form, so each reads its own slot. */
  _errors?: Control[];
  /** `_paths`: the error of every control it reported, keyed by the control. */
  _reported?: Map<Control, any>;
  /** `_paths`: the controls handed out for those errors, made when first asked. */
  readonly _errorControls?: Map<Control, Control>;
  /** `_paths`: the reader itself, one per validator. */
  _errorOf?(control: Control): Control;
  /** Only the latest run writes the error, so a stale resolution is dropped. */
  _attempt: number;
  /** Runs in flight - `validate` twice over is two of them, and one answer. */
  _pending: number;
  _invalid: boolean;
  /** The fields it currently marks, so a run clears the ones it stops marking. */
  _marked: FieldEntry[];
  /** The fields its in-flight check counts towards, captured when it started. */
  _pendingEntries: FieldEntry[];
  /** Watches its controls while it validates on change, or holds an error. */
  _unwatch: () => void;
};

/** @internal */
export type FieldEntry = {
  readonly _control: Control;
  readonly _form: FormInternals;
  /** Whether it sits under the form control, which is what has a baseline. */
  readonly _tracked: boolean;
  /**
   * Only maintained while the form tracks dirtiness - which a per-field
   * `$isDirty` starts too, since that is read from here.
   */
  _dirty: boolean;
  /** Validators holding an error for this exact control. */
  _errorCount: number;
  /** Validators covering it with a check in flight. */
  _pendingCount: number;
  /** Mounted consumers; the entry dies at zero. */
  _refs: number;
  _unwatchDirty: (() => void) | undefined;
  /** What `ref` is holding - the focus target of a failed submit. */
  _element: HTMLElement | undefined;
  /** Set by `useNativeField`; the element owns the value while it is. */
  _native: NativeKind | undefined;
  /** Sit between the element and the control, in both directions - `identity` unless converted. */
  _parse(value: any): any;
  _format(value: any): any;
  /** The node describing this field's error, pointed at while it holds one. */
  _errorId: string | undefined;
  /** Whatever else describes the field, which it composes with `_errorId`. */
  _describedBy: string | undefined;
  /** The last `aria-describedby` and `aria-invalid` written, so a render that changes neither touches no DOM. */
  _described: string | undefined;
  _invalid: boolean;
  /** Set while an element is bound; `useNativeField`'s hook for keeping aria in step with the error. */
  _syncAria: () => void;
  _errorControl: Control<boolean> | undefined;
  _validatingControl: Control<boolean> | undefined;
  _dirtyControl: Control<boolean> | undefined;
  _state: FieldState | undefined;
};

/** @internal */
export type FormInternals = FormState & {
  /** What the form submits and what `reset` restores by default. */
  readonly _control: Control;
  readonly _entries: Map<Control, FieldEntry>;
  /** Every mounted validator, in the order they registered. */
  readonly _validators: ValidatorInternals[];
  /**
   * The ones that validate on blur - a mode is read once, so a validator never
   * changes bucket, and leaving a field walks these instead of all of them.
   */
  readonly _blurValidators: ValidatorInternals[];
  /** What the fields compare against: the form control's value, taken by the mount. */
  _baseline: any;
  /** Whether it has one - a load it is still waiting for does not, yet. */
  _baselined: boolean;
  _options: FormOptions;
  /** Validators currently holding an error. */
  _errorCount: number;
  /** Validators currently in flight. */
  _pendingCount: number;
  _dirtyCount: number;
  _isSubmitting: boolean;
  _submittingControl: Control<boolean> | undefined;
  _validatingControl: Control<boolean> | undefined;
  _validControl: Control<boolean> | undefined;
  _dirtyControl: Control<boolean> | undefined;
};
