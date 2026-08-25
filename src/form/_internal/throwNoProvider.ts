const throwNoProvider = (): never => {
  throw new Error('no form provider');
};

export default throwNoProvider;
