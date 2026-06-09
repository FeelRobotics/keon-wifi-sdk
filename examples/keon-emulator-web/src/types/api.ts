export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface OAuthAccessToken {
  access_token: string;
}

export interface CognitoAuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export type LogDirection = 'in' | 'out' | 'system' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  direction: LogDirection;
  event: string;
  data: unknown;
}
