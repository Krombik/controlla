const cleanupRegistry = new FinalizationRegistry<() => void>((cleanup) => {
  cleanup();
});

export default cleanupRegistry;
