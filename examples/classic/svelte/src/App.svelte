<script lang="ts">
  import {
    getTokenForKeonWiFi,
    BleManager,
    WifiManager,
    KeonError,
  } from '@feelrobotics/keon-wifi-sdk';
  import type {
    RemoteController,
    KeonDeviceStatus,
    KeonProvisioningEvent,
  } from '@feelrobotics/keon-wifi-sdk';

  // ControlPlane base URL that issues the partner token.
  // Override via VITE_CP_SERVER_URL in .env.
  const CP_SERVER_URL =
    import.meta.env.VITE_CP_SERVER_URL || 'https://api.feel-app.com';

  type ProvisioningEventGroup = KeonProvisioningEvent & { count: number };

  const provisioningEventKey = (event: KeonProvisioningEvent) =>
    event.stage === 'token' && event.source === 'sdk'
      ? 'token-sdk-progress'
      : [
          event.stage,
          event.source,
          event.status,
          event.code ?? '',
          event.message,
        ].join('|');

  const groupProvisioningEvents = (
    events: KeonProvisioningEvent[]
  ): ProvisioningEventGroup[] =>
    events.reduce<ProvisioningEventGroup[]>((groups, event) => {
      const last = groups.at(-1);
      if (last && provisioningEventKey(last) === provisioningEventKey(event)) {
        groups[groups.length - 1] = { ...event, count: last.count + 1 };
        return groups;
      }
      groups.push({ ...event, count: 1 });
      return groups;
    }, []);

  // Auth
  let partnerKey = $state('');
  let userId = $state(8059);
  let manualToken = $state('');
  let feelToken = $state('');
  let registrationToken = $state<string | null>(null);
  let deviceKey = $state('');

  // Provisioning
  let ssid = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let deviceData = $state<unknown>(null);
  let provisioningEvents = $state<KeonProvisioningEvent[]>([]);

  // Control — `manager` is intentionally non-reactive: Svelte's $state would
  // deep-proxy the controller instance and break its methods. UI reactivity is
  // driven by `isConnected` / `deviceStatus` instead.
  let manager: RemoteController | null = null;
  let isConnected = $state(false);
  let deviceStatuses = $state<KeonDeviceStatus[]>([]);

  // Movement / settings parameters
  let moveSpeed = $state(100);
  let movePosition = $state(50);
  let mbSpeed = $state(100);
  let mbMin = $state(0);
  let mbMax = $state(100);
  let intensity = $state(3);
  let statusInterval = $state(10);

  // UI feedback
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  const fail = (e: unknown, prefix = '') =>
    (error = `${prefix}${e instanceof KeonError ? e.message : String(e)}`);

  const addProvisioningEvent = (event: KeonProvisioningEvent) => {
    provisioningEvents = [...provisioningEvents, event];
  };

  function authenticate() {
    if (!partnerKey) {
      error = 'Please enter your Partner Key';
      return;
    }
    error = success = null;
    const base = CP_SERVER_URL.replace(/\/+$/, '');
    const url = `${base}/api/v1/partner/${encodeURIComponent(partnerKey)}/token${
      userId ? `?user=${userId}` : ''
    }`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function submitToken() {
    if (!manualToken) {
      error = 'Please paste the token from the opened tab';
      return;
    }
    isLoading = true;
    error = success = null;
    try {
      feelToken = manualToken.trim();
      const { registrationToken: rt, deviceConnectionKey } =
        await getTokenForKeonWiFi(feelToken, deviceKey || null);
      registrationToken = rt;
      deviceKey = deviceConnectionKey;
      success = `Token accepted. Device connection key: ${deviceConnectionKey}`;
    } catch (e) {
      fail(e, 'Failed to process token: ');
    } finally {
      isLoading = false;
    }
  }

  async function provision() {
    if (!registrationToken) {
      error = 'Get a token first';
      return;
    }
    if (!ssid || !password) {
      error = 'Enter both WiFi name and password';
      return;
    }
    isLoading = true;
    error = success = null;
    provisioningEvents = [];
    try {
      const ble = await BleManager.connect();
      try {
        await ble.provision(ssid, password, registrationToken, {
          onStatus: addProvisioningEvent,
          postProvisionListenUntilDisconnect: true,
        });
        deviceData = ble.deviceInfo;
      } finally {
        await ble.disconnect();
      }
      success = 'Device provisioned successfully!';
    } catch (e) {
      fail(e, 'Provisioning failed: ');
    } finally {
      isLoading = false;
    }
  }

  async function connect() {
    if (!feelToken || !registrationToken) {
      error = 'Get a token first';
      return;
    }
    isLoading = true;
    error = success = null;
    try {
      manager = await WifiManager.connect(feelToken, registrationToken, {
        onStatusChange: (s) => (deviceStatuses = s),
      });
      isConnected = true;
      success = 'Connected to the control server.';
    } catch (e) {
      fail(e, 'Connection failed: ');
      isConnected = false;
      manager = null;
    } finally {
      isLoading = false;
    }
  }

  async function disconnect() {
    try {
      await manager?.disconnect();
    } catch (e) {
      fail(e);
    }
    manager = null;
    isConnected = false;
    deviceStatuses = [];
    success = 'Disconnected.';
  }
</script>

<div class="app">
  <header class="app-header">
    <div class="app-logo">K</div>
    <div>
      <h1>Keon WiFi SDK</h1>
      <p>Svelte 5 example</p>
    </div>
  </header>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {:else if success}
    <div class="alert alert-success">{success}</div>
  {/if}

  <!-- 1. Authentication -->
  <section class="card">
    <h2 class="section-title">1 · Authentication</h2>
    <div class="row">
      <div class="field">
        <label for="partnerKey">Partner Key</label>
        <input id="partnerKey" bind:value={partnerKey} placeholder="Enter your partner key" />
      </div>
      <div class="field">
        <label for="userId">User ID</label>
        <input id="userId" type="number" bind:value={userId} placeholder="User ID" />
      </div>
    </div>
    <button class="btn btn-block" onclick={authenticate} disabled={isLoading}>
      Authenticate (open token page)
    </button>
    <p class="hint">
      Opens the partner token URL in a new tab. Copy the returned token and paste it below.
    </p>

    <div class="field" style="margin-top:16px">
      <label for="deviceKey">Device Connection Key (optional)</label>
      <input id="deviceKey" bind:value={deviceKey} maxlength="8" placeholder="8 characters" />
    </div>

    <div class="field">
      <label for="token">Token</label>
      <textarea id="token" bind:value={manualToken} placeholder="Paste token from the opened tab"></textarea>
    </div>
    <button class="btn" onclick={submitToken} disabled={isLoading || !manualToken}>
      {isLoading ? 'Processing…' : 'Submit Token'}
    </button>
  </section>

  <!-- 2. Provisioning -->
  <section class="card">
    <h2 class="section-title">2 · Device Provisioning (Bluetooth)</h2>
    <div class="field">
      <label for="ssid">WiFi SSID</label>
      <input id="ssid" bind:value={ssid} placeholder="Enter WiFi name" autocomplete="username" />
    </div>
    <div class="field">
      <label for="password">WiFi Password</label>
      <div class="password-field">
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          bind:value={password}
          placeholder="Enter WiFi password"
          autocomplete="current-password"
        />
        <button
          type="button"
          class="password-toggle"
          onclick={() => (showPassword = !showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
    <button class="btn" onclick={provision} disabled={!registrationToken || isLoading}>
      {isLoading ? 'Provisioning…' : 'Provision Device'}
    </button>

    {#if provisioningEvents.length}
      <div class="provisioning-log">
        <div class="provisioning-log-title">Provisioning status</div>
        {#each groupProvisioningEvents(provisioningEvents) as event, i (`${event.stage}-${event.source}-${i}`)}
          <div class="provisioning-event status-{event.status}">
            <div class="provisioning-event-main">
              <span>{event.stage}</span>
              <span>
                {event.status}
                {#if event.count > 1}
                  <span class="provisioning-count">x{event.count}</span>
                {/if}
              </span>
            </div>
            <div class="provisioning-event-message">{event.message}</div>
            {#if event.stage === 'token' && event.source === 'sdk' && event.chunkIndex && event.chunkTotal}
              <div class="provisioning-progress">
                <div style={`width: ${(event.chunkIndex / event.chunkTotal) * 100}%`}></div>
              </div>
            {/if}
            <div class="provisioning-event-meta">
              {event.source}
              {#if event.code !== undefined}
                · code {event.code}
              {/if}
              {#if event.rawValue?.length}
                · raw [{event.rawValue.join(', ')}]
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if deviceData}
      <h3 style="margin:20px 0 8px;font-size:14px">Device Data</h3>
      <pre class="code">{JSON.stringify(deviceData, null, 2)}</pre>
    {/if}
  </section>

  <!-- 3. Control -->
  {#if registrationToken}
    <section class="card">
      <h2 class="section-title">3 · Device Control</h2>

      <div class="subcard">
        <h3>
          <span class="dot {isConnected ? 'dot-on' : 'dot-off'}"></span>
          Connection
        </h3>
        <div class="btn-row">
          {#if isConnected}
            <button class="btn btn-danger" onclick={disconnect}>Disconnect</button>
          {:else}
            <button class="btn" onclick={connect} disabled={isLoading}>
              {isLoading ? 'Connecting…' : 'Connect to Server'}
            </button>
          {/if}
        </div>

        {#if isConnected && deviceStatuses.length}
          {#each deviceStatuses as status, i (i)}
            <div class="status-grid">
              {#each Object.entries(status) as [k, v]}
                <div class="status-item">
                  <div class="k">{k}</div>
                  <div class="v">{v}</div>
                </div>
              {/each}
            </div>
          {/each}
        {:else if isConnected}
          <p class="muted" style="margin-top:10px">Waiting for device status…</p>
        {/if}
      </div>

      <div class="subcard">
        <h3>Movement</h3>
        <div class="control-row">
          <div class="field num">
            <label for="ms">Speed</label>
            <input id="ms" type="number" bind:value={moveSpeed} min="0" max="100" step="1" />
          </div>
          <div class="field num">
            <label for="mp">Position</label>
            <input id="mp" type="number" bind:value={movePosition} min="0" max="100" step="1" />
          </div>
          <button class="btn grow" onclick={() => manager?.moveTo(moveSpeed, movePosition)} disabled={!isConnected}>
            Move To
          </button>
        </div>
        <div class="control-row">
          <div class="field num">
            <label for="mbs">Speed</label>
            <input id="mbs" type="number" bind:value={mbSpeed} min="0" max="100" step="1" />
          </div>
          <div class="field num">
            <label for="mbmin">Min</label>
            <input id="mbmin" type="number" bind:value={mbMin} min="0" max="100" step="1" />
          </div>
          <div class="field num">
            <label for="mbmax">Max</label>
            <input id="mbmax" type="number" bind:value={mbMax} min="0" max="100" step="1" />
          </div>
          <button
            class="btn grow"
            onclick={() => manager?.movementBetween(mbSpeed, mbMin, mbMax)}
            disabled={!isConnected}
          >
            Move Between
          </button>
        </div>
        <div class="btn-row">
          <button class="btn btn-danger" onclick={() => manager?.stop()} disabled={!isConnected}>
            Stop All Movement
          </button>
        </div>
      </div>

      <div class="subcard">
        <h3>Settings</h3>
        <div class="control-row">
          <div class="field num">
            <label for="int">Intensity</label>
            <input id="int" type="number" bind:value={intensity} min="0" max="10" step="1" />
          </div>
          <button
            class="btn grow"
            onclick={() => manager?.setIntensity(intensity)}
            disabled={!isConnected}
          >
            Set Intensity
          </button>
        </div>
        <div class="control-row">
          <div class="field num">
            <label for="si">Status interval (s)</label>
            <input id="si" type="number" bind:value={statusInterval} min="0" max="10" step="1" />
          </div>
          <button
            class="btn grow"
            onclick={() => manager?.setStatusInterval(statusInterval)}
            disabled={!isConnected}
          >
            Set Interval
          </button>
        </div>
        <div class="btn-row">
          <button class="btn btn-secondary" onclick={() => manager?.forceStatusReport()} disabled={!isConnected}>
            Force Status Report
          </button>
        </div>
      </div>
    </section>
  {/if}
</div>
