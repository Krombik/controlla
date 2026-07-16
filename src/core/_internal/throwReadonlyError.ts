const throwReadonlyError = () => {
  throw new Error('the control is readonly');
};

export default throwReadonlyError;
