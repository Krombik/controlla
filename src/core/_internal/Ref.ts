const Ref: typeof WeakRef =
  typeof WeakRef != 'undefined'
    ? WeakRef
    : (class {
        readonly _value: any;

        constructor(value: any) {
          this._value = value;
        }

        deref() {
          return this._value;
        }
      } as typeof WeakRef);

export default Ref;
