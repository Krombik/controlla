/** A real DOM on the globals, installed before any lib module reads them. */

import { Window } from 'happy-dom';

export const win = new Window({ url: 'http://localhost/' });

/** Errors the lib reported - without this its fallback kills the process. */
export const reportedErrors: unknown[] = [];

const globals: Record<string, unknown> = {
  // not a happy-dom global, and the lib reads it once at import
  reportError: (error: unknown) => {
    reportedErrors.push(error);
  },
};

for (const key of [
  'window',
  'document',
  'history',
  'location',
  'Event',
  'CustomEvent',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'InputEvent',
  'MutationObserver',
  'ResizeObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'sessionStorage',
  'localStorage',
] as const) {
  globals[key] = (win as any)[key];
}

const keys = Object.keys(globals);

for (let i = 0; i < keys.length; i++) {
  Object.defineProperty(globalThis, keys[i], {
    value: globals[keys[i]],
    configurable: true,
    writable: true,
  });
}

/**
 * happy-dom leaves `RadioNodeList.value` read-only. The DOM spec makes it
 * settable - checking the radio of the group whose value matches - and a radio
 * field writes the whole group through it.
 */
const sampleForm = win.document.createElement('form');

win.document.body.appendChild(sampleForm);

// two of them: a lone radio comes back as the element itself
for (let i = 0; i < 2; i++) {
  const sampleRadio = win.document.createElement('input');

  sampleRadio.type = 'radio';

  sampleRadio.name = 'probe';

  sampleForm.appendChild(sampleRadio);
}

const radioNodeList = Object.getPrototypeOf(
  sampleForm.elements.namedItem('probe')!
);

const valueDescriptor = Object.getOwnPropertyDescriptor(
  radioNodeList,
  'value'
)!;

if (!valueDescriptor.set) {
  Object.defineProperty(radioNodeList, 'value', {
    get: valueDescriptor.get,
    // `item`, not an index: inside the setter `this` is the list itself rather
    // than the proxy the lookup hands out, and only that reaches the radios
    set(this: any, value: string) {
      for (let i = 0; i < this.length; i++) {
        const radio = this.item(i);

        radio.checked = radio.value === value;
      }
    },
    configurable: true,
  });
}

sampleForm.remove();
