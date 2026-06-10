const tranformDataToArray = (
  arr: Array<number> | ArrayBuffer | string
): Uint8Array => {
  let buffer: ArrayBuffer;

  if (Array.isArray(arr)) {
    buffer = new ArrayBuffer(arr.length);
    const view = new Uint8Array(buffer);
    arr.forEach((v, indx) => {
      view[indx] = v;
    });
    return view;
  } else if (arr instanceof ArrayBuffer) {
    return new Uint8Array(arr);
  } else if (typeof arr === 'string') {
    const encoder = new TextEncoder();
    return encoder.encode(arr);
  } else {
    throw new Error(
      'Invalid input type. Expected Array<number>, ArrayBuffer, or string.'
    );
  }
};

const displayToken = (token: string | null = null): string => {
  if (!token) {
    return '';
  }

  if (token.length <= 30) {
    return token;
  }
  const first20 = token.slice(0, 20);
  const last10 = token.slice(-10);
  return `${first20}...${last10}`;
};

export { tranformDataToArray, displayToken };
/**
 * Reads data from a DataView and returns an ASCII string
 * if all bytes are within the printable ASCII range (32..126).
 * Returns an empty string if at least one byte falls outside this range.
 */
export const dataViewToAsciiString = (data: DataView): string => {
  // First, check if all bytes are in the ASCII printable range 32..126
  for (let i = 0; i < data.byteLength; i++) {
    const ch = data.getUint8(i);
    if (ch < 32 || ch > 126) {
      return '';
    }
  }

  // If all characters are printable ASCII, collect and return the string
  let asciiResult = '';
  for (let i = 0; i < data.byteLength; i++) {
    asciiResult += String.fromCharCode(data.getUint8(i));
  }
  return asciiResult;
};

export const wait = (msecs: number) =>
  new Promise(resolve => {
    setTimeout(resolve, msecs);
  });
