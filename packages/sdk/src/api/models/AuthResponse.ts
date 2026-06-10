import { JwtPayload } from 'jwt-decode';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
}

export interface ResponseRegistrationToken {
  registration_token: string;
}

export interface TokenPayload<T = unknown> extends JwtPayload {
  user_email: string;
  token_type: string;
  user_id: string;
  original_token_type: string;
  data: T;
  device_connection_key: string;
}

export interface RegistrationTokenData {
  oauth_server_url: string;
  wss_cc_server_url: string;
  exchange_endpoint: string;
  refresh_endpoint: string;
}
