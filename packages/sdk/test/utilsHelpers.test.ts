import {
  transformDataToArray,
  displayToken,
  dataViewToAsciiString,
} from '../src/utils/helpers';

describe('transformDataToArray', () => {
  it('converts a number array to a Uint8Array', () => {
    expect(Array.from(transformDataToArray([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it('encodes a string to UTF-8 bytes', () => {
    expect(Array.from(transformDataToArray('AB'))).toEqual([65, 66]);
  });

  it('wraps an ArrayBuffer', () => {
    const buffer = new Uint8Array([7, 8, 9]).buffer;
    expect(Array.from(transformDataToArray(buffer))).toEqual([7, 8, 9]);
  });
});

describe('dataViewToAsciiString', () => {
  it('decodes printable ASCII', () => {
    const dv = new DataView(new Uint8Array([72, 105]).buffer);
    expect(dataViewToAsciiString(dv)).toBe('Hi');
  });

  it('returns empty string when any byte is non-printable', () => {
    const dv = new DataView(new Uint8Array([72, 0]).buffer);
    expect(dataViewToAsciiString(dv)).toBe('');
  });
});

describe('displayToken', () => {
  it('returns empty string for null', () => {
    expect(displayToken(null)).toBe('');
  });

  it('returns short tokens unchanged', () => {
    expect(displayToken('short')).toBe('short');
  });

  it('masks the middle of long tokens', () => {
    const token = 'a'.repeat(40);
    const masked = displayToken(token);
    expect(masked).toContain('...');
    expect(masked.length).toBeLessThan(token.length);
  });
});
