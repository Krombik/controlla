import noop from '#internal/noop';

const cleanupRegistry: FinalizationRegistry<() => void> =
  typeof FinalizationRegistry != 'undefined'
    ? new FinalizationRegistry<() => void>((cleanup) => {
        cleanup();
      })
    : ({ register: noop } as Partial<
        FinalizationRegistry<any>
      > as FinalizationRegistry<any>);

export default cleanupRegistry;
