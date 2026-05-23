const throwReadonlyError = () => {
  throw new Error('Control is readonly');
};

export default throwReadonlyError;
