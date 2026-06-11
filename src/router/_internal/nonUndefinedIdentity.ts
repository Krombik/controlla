const nonUndefinedIdentity = (value: any, key: string) => {
  if (value === undefined) {
    throw new Error(`${key} is required`);
  }

  return value;
};

export default nonUndefinedIdentity;
