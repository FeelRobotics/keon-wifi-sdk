/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COGNITO_REGION?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_OAUTH_SERVER_URL?: string;
  readonly VITE_FEC_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
