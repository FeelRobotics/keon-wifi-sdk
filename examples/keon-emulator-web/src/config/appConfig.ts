export interface AppConfigValues {
  cognitoRegion: string;
  cognitoClientId: string;
  oauthServerUrl: string;
  fecServerUrl: string;
}

export type AppConfigEnv = Partial<{
  VITE_COGNITO_REGION: string;
  VITE_COGNITO_CLIENT_ID: string;
  VITE_OAUTH_SERVER_URL: string;
  VITE_FEC_SERVER_URL: string;
}>;

export const DEFAULT_APP_CONFIG: AppConfigValues = {
  cognitoRegion: 'us-east-1',
  cognitoClientId: '66n37ek7b6o4b30dqg2h6mitrq',
  oauthServerUrl: 'https://oauth-fec-us.feelme.com',
  fecServerUrl: 'https://fec.feelme.com',
};

function configValue(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export class AppConfig {
  private readonly values: AppConfigValues;

  constructor(overrides: Partial<AppConfigValues> = {}) {
    this.values = {
      cognitoRegion: configValue(overrides.cognitoRegion, DEFAULT_APP_CONFIG.cognitoRegion),
      cognitoClientId: configValue(overrides.cognitoClientId, DEFAULT_APP_CONFIG.cognitoClientId),
      oauthServerUrl: configValue(overrides.oauthServerUrl, DEFAULT_APP_CONFIG.oauthServerUrl),
      fecServerUrl: configValue(overrides.fecServerUrl, DEFAULT_APP_CONFIG.fecServerUrl),
    };
  }

  static fromEnv(env: AppConfigEnv): AppConfig {
    return new AppConfig({
      cognitoRegion: env.VITE_COGNITO_REGION,
      cognitoClientId: env.VITE_COGNITO_CLIENT_ID,
      oauthServerUrl: env.VITE_OAUTH_SERVER_URL,
      fecServerUrl: env.VITE_FEC_SERVER_URL,
    });
  }

  get cognitoRegion(): string {
    return this.values.cognitoRegion;
  }

  get cognitoClientId(): string {
    return this.values.cognitoClientId;
  }

  get oauthServerUrl(): string {
    return this.values.oauthServerUrl;
  }

  get fecServerUrl(): string {
    return this.values.fecServerUrl;
  }

  toJSON(): AppConfigValues {
    return { ...this.values };
  }
}

export const appConfig = AppConfig.fromEnv(import.meta.env);
