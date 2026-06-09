<script lang="ts">
  import { FugManager } from '@feelrobotics/keon-wifi-sdk';
  import type { KeonDeviceStatus } from '@feelrobotics/keon-wifi-sdk';

  // FUG controls an already-provisioned device with only a deviceConnectionKey.
  let manager = $state<FugManager | null>(null);
  let statuses = $state<KeonDeviceStatus[]>([]);
  let error = $state<string | null>(null);
  let busy = $state(false);

  let dck = $state('');
  let pollSec = $state(30);
  let speed = $state(50);
  let position = $state(50);
  let betweenSpeed = $state(50);
  let minPos = $state(0);
  let maxPos = $state(100);
  let intensity = $state(50);
  let statusInterval = $state(200);

  // Friendly labels and units for the raw device-status keys.
  const STATUS_LABELS: Record<string, string> = {
    battery_status: 'Battery',
    wifi_strength: 'Wi-Fi',
    motor_speed: 'Motor speed',
    encoder_pos: 'Position',
    intensity: 'Intensity',
    stroker_level: 'Stroker level',
    error_code: 'Error',
    firmware_version: 'Firmware',
    serial_number: 'Serial',
    status_package: 'Status',
    status_period: 'Status interval',
    ble_address: 'BLE address',
  };
  const STATUS_UNITS: Record<string, string> = { battery_status: '%' };

  async function run(fn: () => Promise<void>) {
    error = null;
    busy = true;
    try {
      await fn();
    } catch (e) {
      error = String(e);
    } finally {
      busy = false;
    }
  }

  function connect() {
    run(async () => {
      if (!dck.trim()) throw new Error('Enter a deviceConnectionKey');
      manager = await FugManager.connect({
        deviceConnectionKey: dck.trim(),
        statusPollIntervalSec: pollSec,
        onStatusChange: (s) => {
          statuses = s;
        },
      });
      // The SDK doesn't fetch on connect; pull the initial status ourselves.
      await manager.forceStatusReport();
    });
  }

  async function disconnect() {
    await manager?.disconnect();
    manager = null;
    statuses = [];
  }

  function need(): FugManager {
    if (!manager) throw new Error('Not connected');
    return manager;
  }

  function confirmThen(message: string, fn: () => Promise<void>) {
    if (window.confirm(message)) run(fn);
  }
</script>

<div class="app">
  <header>
    <h1>Keon FUG Console</h1>
    <span class={manager ? 'badge on' : 'badge'}>
      {manager ? 'connected' : 'disconnected'}
    </span>
  </header>

  <section class="card">
    <h2>Connection</h2>
    <p class="hint">
      FUG controls an <strong>already-provisioned</strong> device. Get a
      <code>deviceConnectionKey</code> from the FeelConnect app (or a
      <code>classic/</code> provisioning example).
    </p>
    <label>
      deviceConnectionKey
      <input bind:value={dck} placeholder="DCK" disabled={!!manager} />
    </label>
    <label>
      status poll (seconds, 0 = off)
      <input type="number" bind:value={pollSec} disabled={!!manager} />
    </label>
    {#if manager}
      <button onclick={disconnect}>Disconnect</button>
    {:else}
      <button disabled={busy} onclick={connect}>Connect</button>
    {/if}
  </section>

  <section class="card" data-disabled={!manager}>
    <h2>Movement</h2>
    <label class="slider"
      ><span>speed: {speed}</span>
      <input type="range" min="0" max="100" bind:value={speed} /></label
    >
    <label class="slider"
      ><span>position: {position}</span>
      <input type="range" min="0" max="100" bind:value={position} /></label
    >
    <button
      disabled={!manager || busy}
      onclick={() => run(() => need().moveTo(speed, position))}
    >
      Move to
    </button>

    <label class="slider"
      ><span>between speed: {betweenSpeed}</span>
      <input type="range" min="0" max="100" bind:value={betweenSpeed} /></label
    >
    <label class="slider"
      ><span>min: {minPos}</span>
      <input type="range" min="0" max="100" bind:value={minPos} /></label
    >
    <label class="slider"
      ><span>max: {maxPos}</span>
      <input type="range" min="0" max="100" bind:value={maxPos} /></label
    >
    <button
      disabled={!manager || busy}
      onclick={() =>
        run(() => need().movementBetween(betweenSpeed, minPos, maxPos))}
    >
      Movement between
    </button>

    <button
      class="danger"
      disabled={!manager || busy}
      onclick={() => run(() => need().stop())}
    >
      Stop
    </button>
  </section>

  <section class="card" data-disabled={!manager}>
    <h2>Settings</h2>
    <label class="slider"
      ><span>intensity %: {intensity}</span>
      <input type="range" min="0" max="100" bind:value={intensity} /></label
    >
    <button
      disabled={!manager || busy}
      onclick={() => run(() => need().setIntensity(intensity))}
    >
      Set intensity
    </button>
    <label class="slider"
      ><span>status interval: {statusInterval}</span>
      <input
        type="range"
        min="0"
        max="1000"
        bind:value={statusInterval}
      /></label
    >
    <button
      disabled={!manager || busy}
      onclick={() => run(() => need().setStatusInterval(statusInterval))}
    >
      Set status interval
    </button>
  </section>

  <section class="card" data-disabled={!manager}>
    <h2>Reprovision</h2>
    <div class="row">
      <button
        class="danger"
        disabled={!manager || busy}
        onclick={() =>
          confirmThen('Drop WiFi and return to Bluetooth mode?', () =>
            need().switchToBtMode()
          )}
      >
        Switch to BT mode
      </button>
      <button
        class="danger"
        disabled={!manager || busy}
        onclick={() =>
          confirmThen('Wipe stored WiFi credentials on the device?', () =>
            need().resetCredentials()
          )}
      >
        Reset credentials
      </button>
    </div>
  </section>

  <section class="card" data-disabled={!manager}>
    <h2>Status</h2>
    <button
      class="ghost"
      disabled={!manager || busy}
      onclick={() => run(() => need().forceStatusReport())}
    >
      Force status report
    </button>
    {#if statuses.length === 0}
      <p class="hint">No status yet — connect to a device.</p>
    {:else}
      {#each statuses as status, i (status.serial_number || i)}
        <div class="device">
          {#if statuses.length > 1}
            <h3>{status.serial_number || `Device ${i + 1}`}</h3>
          {/if}
          <div class="metrics">
            {#each Object.entries(status) as [key, value] (key)}
              <div class="metric">
                <span class="k">{STATUS_LABELS[key] ?? key}</span>
                <span class="v"
                  >{value}{#if STATUS_UNITS[key]}<span class="u"
                      >{STATUS_UNITS[key]}</span
                    >{/if}</span
                >
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </section>

  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>
