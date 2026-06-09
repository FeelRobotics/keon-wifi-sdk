import {
  KeonError,
  AuthError,
  KeonBLEError,
  KeonProvisioningError,
} from '../src/errors';

describe('KeonError', () => {
  it('sets name and message correctly', () => {
    const err = new KeonError('base error');
    expect(err.name).toBe('KeonError');
    expect(err.message).toBe('base error');
  });

  it('is an instance of Error', () => {
    expect(new KeonError('x')).toBeInstanceOf(Error);
  });

  it('supports the cause option', () => {
    const cause = new Error('root cause');
    const err = new KeonError('wrapped', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('AuthError', () => {
  it('sets name to AuthError', () => {
    expect(new AuthError('auth failed').name).toBe('AuthError');
  });

  it('is an instance of KeonError and Error', () => {
    const err = new AuthError('x');
    expect(err).toBeInstanceOf(KeonError);
    expect(err).toBeInstanceOf(Error);
  });

  it('supports the cause option', () => {
    const cause = new Error('network');
    const err = new AuthError('failed', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('KeonBLEError', () => {
  it('sets name to KeonBLEError', () => {
    expect(new KeonBLEError('ble failed').name).toBe('KeonBLEError');
  });

  it('is an instance of KeonError', () => {
    expect(new KeonBLEError('x')).toBeInstanceOf(KeonError);
  });

  it('supports the cause option', () => {
    const cause = new Error('device not found');
    const err = new KeonBLEError('selection failed', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('KeonProvisioningError', () => {
  it('sets name to KeonProvisioningError', () => {
    expect(new KeonProvisioningError('prov failed').name).toBe(
      'KeonProvisioningError'
    );
  });

  it('is an instance of KeonError', () => {
    expect(new KeonProvisioningError('x')).toBeInstanceOf(KeonError);
  });
});

describe('error class hierarchy', () => {
  it('all subclass names are unique', () => {
    const names = [
      new KeonError('e').name,
      new AuthError('e').name,
      new KeonBLEError('e').name,
      new KeonProvisioningError('e').name,
    ];
    expect(new Set(names).size).toBe(4);
  });

  it('instanceof KeonError catches all SDK errors', () => {
    const errors = [
      new AuthError('e'),
      new KeonBLEError('e'),
      new KeonProvisioningError('e'),
    ];
    errors.forEach(err => expect(err).toBeInstanceOf(KeonError));
  });

  it('subclass errors are not interchangeable', () => {
    expect(new AuthError('x')).not.toBeInstanceOf(KeonBLEError);
    expect(new KeonBLEError('x')).not.toBeInstanceOf(KeonProvisioningError);
  });
});
