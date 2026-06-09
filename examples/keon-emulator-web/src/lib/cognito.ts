import type { CognitoAuthResult } from '@/types/api';

export interface CognitoConfig {
  region: string;
  clientId: string;
}

interface CognitoSuccessResponse {
  AuthenticationResult: {
    IdToken: string;
    AccessToken: string;
    RefreshToken: string;
  };
}

interface CognitoErrorResponse {
  __type: string;
  message: string;
}

export class UserNotFoundException extends Error {
  constructor() {
    super('User not found in Cognito pool. Please register via the FeelConnect app.');
    this.name = 'UserNotFoundException';
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class CognitoNetworkError extends Error {
  constructor(cause: unknown) {
    super(`Network error communicating with Cognito: ${String(cause)}`);
    this.name = 'CognitoNetworkError';
  }
}

/**
 * Authenticates against AWS Cognito using USER_PASSWORD_AUTH flow.
 * Returns IdToken, AccessToken, and RefreshToken on success.
 * Throws typed errors for user-actionable failures.
 */
export async function authenticateCognito(
  email: string,
  password: string,
  config: CognitoConfig,
): Promise<CognitoAuthResult> {
  const endpoint = `https://cognito-idp.${config.region}.amazonaws.com/`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    });
  } catch (cause) {
    throw new CognitoNetworkError(cause);
  }

  if (!response.ok) {
    const err = (await response.json()) as CognitoErrorResponse;
    const type = err.__type ?? '';

    if (type === 'UserNotFoundException') {
      throw new UserNotFoundException();
    }
    if (type === 'NotAuthorizedException' || type === 'UserNotConfirmedException') {
      throw new InvalidCredentialsError(err.message ?? 'Authentication failed');
    }
    throw new InvalidCredentialsError(err.message ?? `Cognito error: ${type}`);
  }

  const data = (await response.json()) as CognitoSuccessResponse;
  return {
    idToken: data.AuthenticationResult.IdToken,
    accessToken: data.AuthenticationResult.AccessToken,
    refreshToken: data.AuthenticationResult.RefreshToken,
  };
}
