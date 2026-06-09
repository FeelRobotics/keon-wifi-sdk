import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { authenticateCognito, UserNotFoundException, InvalidCredentialsError } from '@/lib/cognito';
import { fetchOAuthTokens } from '@/lib/oauth';
import { decodeJwt } from '@/lib/jwtDecode';
import { appConfig } from '@/config/appConfig';

/**
 * Provisioning block: authenticates via Cognito then exchanges for
 * OAuth access+refresh tokens. Extracts device_connection_key from the
 * JWT claims and populates the Connection Key field.
 */
export function ProvisioningBlock() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);

  const deviceConnectionKey = useAppStore((s) => s.deviceConnectionKey);
  const setTokens = useAppStore((s) => s.setTokens);
  const setDeviceConnectionKey = useAppStore((s) => s.setDeviceConnectionKey);
  const addLog = useAppStore((s) => s.addLog);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canProvision = isEmailValid && password.length > 0 && !loading;

  const handleProvision = async () => {
    setLoading(true);
    setNotification(null);

    try {
      // Step 1: Cognito authentication
      addLog('system', 'cognito:initiateAuth', { email });
      const cognitoResult = await authenticateCognito(email, password, {
        region: appConfig.cognitoRegion,
        clientId: appConfig.cognitoClientId,
      });
      addLog('system', 'cognito:ok', { email });

      // Step 2: Exchange Cognito ID token for OAuth tokens.
      // Forward the existing deviceConnectionKey if the field is already filled.
      const dckPayload = deviceConnectionKey.length === 8 ? deviceConnectionKey : undefined;
      addLog('system', 'oauth:tokenAccess', { dck: dckPayload ?? '(auto)' });

      const tokens = await fetchOAuthTokens(
        cognitoResult.idToken,
        dckPayload,
        appConfig.oauthServerUrl,
        email,
      );
      addLog('system', 'oauth:tokenAccess:ok', {});

      // Step 3: Store tokens.
      setTokens(tokens.access_token, tokens.refresh_token);

      // Step 4: Decode access_token to extract device_connection_key.
      try {
        const claims = decodeJwt(tokens.access_token);
        if (typeof claims.device_connection_key === 'string') {
          setDeviceConnectionKey(claims.device_connection_key);
          addLog('system', 'dck:extracted', { dck: claims.device_connection_key });
        }
      } catch {
        // Non-fatal: DCK extraction failed — user-provided key (if any) remains.
        addLog('error', 'dck:decode:failed', { reason: 'Could not parse JWT claims' });
      }

      setNotification({ type: 'success', message: 'Provisioned successfully.' });
    } catch (err) {
      let message: string;

      if (err instanceof UserNotFoundException) {
        message =
          'Account not found. Please download the FeelConnect app and create an account first.';
        setNotification({ type: 'info', message });
      } else if (err instanceof InvalidCredentialsError) {
        message = `Authentication failed: ${err.message}`;
        setNotification({ type: 'error', message });
      } else {
        message = err instanceof Error ? err.message : String(err);
        setNotification({ type: 'error', message });
      }

      addLog('error', 'provision:failed', { message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="provisioning-block">
      <h3 className="section-title">Provisioning</h3>

      <div className="form-group">
        <label className="form-label" htmlFor="prov-email">
          Email
        </label>
        <input
          id="prov-email"
          type="email"
          className={`form-input ${email && !isEmailValid ? 'invalid' : ''}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          autoComplete="email"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="prov-password">
          Password
        </label>
        <input
          id="prov-password"
          type="password"
          className="form-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={loading}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={() => void handleProvision()}
        disabled={!canProvision}
      >
        {loading ? 'Provisioning…' : 'Provision'}
      </button>

      {notification && (
        <div className={`notification notification-${notification.type}`} role="alert">
          {notification.type === 'info' && <strong>FeelConnect Required: </strong>}
          {notification.message}
        </div>
      )}
    </div>
  );
}
