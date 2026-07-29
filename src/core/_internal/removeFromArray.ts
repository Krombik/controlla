const removeFromArray = <T>(array: T[], item: T) => {
  const lastIndex = array.length - 1;

  if (array[lastIndex] == item) {
    array.length = lastIndex;
  } else {
    for (let i = 0; i < lastIndex; i++) {
      if (array[i] == item) {
        array[i] = array[lastIndex];

        array.length = lastIndex;

        return;
      }
    }
  }
};

export default removeFromArray;
