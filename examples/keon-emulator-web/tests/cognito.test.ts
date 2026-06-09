import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import {
  authenticateCognito,
  UserNotFoundException,
  InvalidCredentialsError,
  CognitoNetworkError,
} from '@/lib/cognito';

const CONFIG = { region: 'us-east-1', clientId: 'test-client-id' };
const ENDPOINT = 'https://cognito-idp.us-east-1.amazonaws.com/';

describe('authenticateCognito', () => {
  it('returns tokens on successful authentication', async () => {
    const result = await authenticateCognito('test@example.com', 'password', CONFIG);
    expect(result.idToken).toBeTruthy();
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBe('mock-refresh-token');
  });

  it('throws UserNotFoundException when Cognito returns UserNotFoundException', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json(
          { __type: 'UserNotFoundException', message: 'User does not exist.' },
          { status: 400 },
        ),
      ),
    );

    await expect(
      authenticateCognito('nobody@example.com', 'pass', CONFIG),
    ).rejects.toBeInstanceOf(UserNotFoundException);
  });

  it('throws InvalidCredentialsError for NotAuthorizedException', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json(
          { __type: 'NotAuthorizedException', message: 'Incorrect username or password.' },
          { status: 400 },
        ),
      ),
    );

    await expect(
      authenticateCognito('test@example.com', 'wrongpass', CONFIG),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for UserNotConfirmedException', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json(
          {
            __type: 'UserNotConfirmedException',
            message: 'User is not confirmed.',
          },
          { status: 400 },
        ),
      ),
    );

    await expect(
      authenticateCognito('unconfirmed@example.com', 'pass', CONFIG),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('throws CognitoNetworkError on fetch failure', async () => {
    server.use(
      http.post(ENDPOINT, () => HttpResponse.error()),
    );

    await expect(
      authenticateCognito('test@example.com', 'pass', CONFIG),
    ).rejects.toBeInstanceOf(CognitoNetworkError);
  });

  it('includes FeelConnect guidance in UserNotFoundException message', () => {
    const err = new UserNotFoundException();
    expect(err.message).toMatch(/FeelConnect/i);
  });
});
