import type { Control, Scheduler } from '#types';
import type { ChangeListener, ControlInternals } from '#internal/types';
import type {
  FieldRenderProps,
  FieldState,
  FormOptions,
  FormState,
  ValidateOn,
} from '#form/types';

/** The elements `NativeField` knows how to read and write. */
export type FieldElement =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * How one kind of native element is read, written and declared - the whole
 * per-type dispatch, resolved once from `NativeField`'s `type`.
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

/** @internal */
export type FieldEntry = {
  readonly _control: Control;
  readonly _form: FormInternals | undefined;
  _validate: ((value: any) => any) | undefined;
  _mode: ValidateOn;
  _keep: boolean;
  /** The baseline of an entry with no form; the rest resolve theirs through `_roots`. */
  _snapshot: any;
  /**
   * Only maintained while the form tracks dirtiness - which a per-field
   * `$isDirty` starts too, since that is read from here.
   */
  _dirty: boolean;
  _error: any;
  /** Async validations in flight — the field is validating while above zero. */
  _pending: number;
  /** Only the latest run writes `_error`, so a stale resolution is dropped. */
  _attempt: number;
  /** Mounted `Field`/`useFieldState` consumers; the entry dies at zero. */
  _refs: number;
  _unwatch: (() => void) | undefined;
  _unwatchDirty: (() => void) | undefined;
  /** What `ref` is holding - the focus target of a failed submit. */
  _element: HTMLElement | undefined;
  /** Set by `NativeField`; the element owns the value while it is. */
  _native: NativeKind | undefined;
  /** What the element's writes are committed through - the default flush unless given. */
  _scheduler: Scheduler | undefined;
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
  /** Set while an element is bound; `NativeField`'s hook for keeping aria in step with the error. */
  _syncAria: () => void;
  _errorControl: Control<any> | undefined;
  _validatingControl: Control<boolean> | undefined;
  _dirtyControl: Control<boolean> | undefined;
  _state: FieldState | undefined;
  _props: FieldRenderProps | undefined;
};

/** @internal */
export type FormInternals = FormState & {
  /** What the form submits and what `reset` restores by default. */
  readonly _control: Control;
  readonly _entries: Map<Control, FieldEntry>;
  /** Baseline value per root, captured when the form first registers a field of it. */
  readonly _roots: Map<ControlInternals, any>;
  /** The load watch held on every async root the form baselines against. */
  readonly _armedRoots: Map<ControlInternals, ChangeListener>;
  _options: FormOptions;
  _errorCount: number;
  _pendingCount: number;
  _dirtyCount: number;
  /** Whether the load watches of `_armedRoots` are subscribed. */
  _attached: boolean;
  _isSubmitting: boolean;
  _submittingControl: Control<boolean> | undefined;
  _validatingControl: Control<boolean> | undefined;
  _validControl: Control<boolean> | undefined;
  _dirtyControl: Control<boolean> | undefined;
};
