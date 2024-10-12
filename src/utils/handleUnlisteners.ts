const handleUnlisteners = (
  valueUnlistener: () => void,
  loadUnlistener: (() => void) | false
) =>
  loadUnlistener
    ? () => {
        valueUnlistener();

        loadUnlistener();
      }
    : valueUnlistener;

export default handleUnlisteners;
