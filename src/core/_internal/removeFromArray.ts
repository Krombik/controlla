const removeFromArray = <T>(array: T[], item: T) => {
  const last = array.pop()!;

  if (item != last) {
    for (let i = 0, l = array.length; i < l; i++) {
      if (array[i] == item) {
        array[i] = last;

        return;
      }
    }
  }
};

export default removeFromArray;
