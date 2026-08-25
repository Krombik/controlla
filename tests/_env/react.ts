// the DOM must be on the globals before react-dom is loaded
import { win } from './happyDom.ts';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement } = await import('react');

const { createRoot } = await import('react-dom/client');

export { act, createElement };

/**
 * Mounts {@link element} into a fresh root of the real DOM, so what depends on
 * how React commits - the order of the effect walks, what a `Suspense`
 * boundary tears down, what `Activity` does - is run rather than modelled.
 */
export const mount = async (element: any) => {
  const container = win.document.createElement('div');

  win.document.body.appendChild(container);

  const root = createRoot(container as any);

  await act(async () => {
    root.render(element);
  });

  return {
    container,
    render: async (next: any) => {
      await act(async () => {
        root.render(next);
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    },
  };
};
