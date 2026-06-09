import { describe, expect, it } from 'vitest';
import { AppConfig, DEFAULT_APP_CONFIG } from '@/config/appConfig';

describe('AppConfig', () => {
  it('uses default values when no overrides are provided', () => {
    expect(new AppConfig().toJSON()).toEqual(DEFAULT_APP_CONFIG);
  });

  it('uses default values for empty overrides', () => {
    const config = new AppConfig({
      cognitoRegion: '',
      oauthServerUrl: '   ',
    });

    expect(config.cognitoRegion).toBe(DEFAULT_APP_CONFIG.cognitoRegion);
    expect(config.oauthServerUrl).toBe(DEFAULT_APP_CONFIG.oauthServerUrl);
  });

  it('maps Vite env names to config properties', () => {
    const config = AppConfig.fromEnv({
      VITE_COGNITO_REGION: 'eu-west-1',
      VITE_COGNITO_CLIENT_ID: 'client-id',
      VITE_OAUTH_SERVER_URL: 'https://oauth.example.com',
      VITE_FEC_SERVER_URL: 'https://fec.example.com',
    });

    expect(config.toJSON()).toEqual({
      cognitoRegion: 'eu-west-1',
      cognitoClientId: 'client-id',
      oauthServerUrl: 'https://oauth.example.com',
      fecServerUrl: 'https://fec.example.com',
    });
  });
});
