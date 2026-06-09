<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
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
const partnerKey = ref('');
const userId = ref(8059);
const manualToken = ref('');
const feelToken = ref('');
const registrationToken = ref<string | null>(null);
const deviceKey = ref('');

// Provisioning
const ssid = ref('');
const password = ref('');
const showPassword = ref(false);
const deviceData = ref<unknown>(null);
const provisioningEvents = ref<KeonProvisioningEvent[]>([]);
const provisioningEventGroups = computed(() =>
  groupProvisioningEvents(provisioningEvents.value)
);

// Control
const manager = shallowRef<RemoteController | null>(null);
const isConnected = ref(false);
const deviceStatuses = ref<KeonDeviceStatus[]>([]);

// Movement / settings parameters
const moveSpeed = ref(100);
const movePosition = ref(50);
const mbSpeed = ref(100);
const mbMin = ref(0);
const mbMax = ref(100);
const intensity = ref(3);
const statusInterval = ref(10);

// UI feedback
const isLoading = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

const fail = (e: unknown, prefix = '') =>
  (error.value = `${prefix}${e instanceof KeonError ? e.message : String(e)}`);

const addProvisioningEvent = (event: KeonProvisioningEvent) => {
  provisioningEvents.value = [...provisioningEvents.value, event];
};

function authenticate() {
  if (!partnerKey.value) {
    error.value = 'Please enter your Partner Key';
    return;
  }
  error.value = success.value = null;
  const base = CP_SERVER_URL.replace(/\/+$/, '');
  const url = `${base}/api/v1/partner/${encodeURIComponent(partnerKey.value)}/token${
    userId.value ? `?user=${userId.value}` : ''
  }`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function submitToken() {
  if (!manualToken.value) {
    error.value = 'Please paste the token from the opened tab';
    return;
  }
  isLoading.value = true;
  error.value = success.value = null;
  try {
    feelToken.value = manualToken.value.trim();
    const { registrationToken: rt, deviceConnectionKey } =
      await getTokenForKeonWiFi(feelToken.value, deviceKey.value || null);
    registrationToken.value = rt;
    deviceKey.value = deviceConnectionKey;
    success.value = `Token accepted. Device connection key: ${deviceConnectionKey}`;
  } catch (e) {
    fail(e, 'Failed to process token: ');
  } finally {
    isLoading.value = false;
  }
}

async function provision() {
  if (!registrationToken.value) {
    error.value = 'Get a token first';
    return;
  }
  if (!ssid.value || !password.value) {
    error.value = 'Enter both WiFi name and password';
    return;
  }
  isLoading.value = true;
  error.value = success.value = null;
  provisioningEvents.value = [];
  try {
    const ble = await BleManager.connect();
    try {
      await ble.provision(ssid.value, password.value, registrationToken.value, {
        onStatus: addProvisioningEvent,
        postProvisionListenUntilDisconnect: true,
      });
      deviceData.value = ble.deviceInfo;
    } finally {
      await ble.disconnect();
    }
    success.value = 'Device provisioned successfully!';
  } catch (e) {
    fail(e, 'Provisioning failed: ');
  } finally {
    isLoading.value = false;
  }
}

async function connect() {
  if (!feelToken.value || !registrationToken.value) {
    error.value = 'Get a token first';
    return;
  }
  isLoading.value = true;
  error.value = success.value = null;
  try {
    manager.value = await WifiManager.connect(
      feelToken.value,
      registrationToken.value,
      { onStatusChange: (s) => (deviceStatuses.value = s) }
    );
    isConnected.value = true;
    success.value = 'Connected to the control server.';
  } catch (e) {
    fail(e, 'Connection failed: ');
    isConnected.value = false;
    manager.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function disconnect() {
  try {
    await manager.value?.disconnect();
  } catch (e) {
    fail(e);
  }
  manager.value = null;
  isConnected.value = false;
  deviceStatuses.value = [];
  success.value = 'Disconnected.';
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="app-logo">K</div>
      <div>
        <h1>Keon WiFi SDK</h1>
        <p>Vue 3 example</p>
      </div>
    </header>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-else-if="success" class="alert alert-success">{{ success }}</div>

    <!-- 1. Authentication -->
    <section class="card">
      <h2 class="section-title">1 · Authentication</h2>
      <div class="row">
        <div class="field">
          <label for="partnerKey">Partner Key</label>
          <input id="partnerKey" v-model="partnerKey" placeholder="Enter your partner key" />
        </div>
        <div class="field">
          <label for="userId">User ID</label>
          <input id="userId" type="number" v-model.number="userId" placeholder="User ID" />
        </div>
      </div>
      <button class="btn btn-block" @click="authenticate" :disabled="isLoading">
        Authenticate (open token page)
      </button>
      <p class="hint">
        Opens the partner token URL in a new tab. Copy the returned token and paste it below.
      </p>

      <div class="field" style="margin-top: 16px">
        <label for="deviceKey">Device Connection Key (optional)</label>
        <input id="deviceKey" v-model="deviceKey" maxlength="8" placeholder="8 characters" />
      </div>

      <div class="field">
        <label for="token">Token</label>
        <textarea id="token" v-model="manualToken" placeholder="Paste token from the opened tab"></textarea>
      </div>
      <button class="btn" @click="submitToken" :disabled="isLoading || !manualToken">
        {{ isLoading ? 'Processing…' : 'Submit Token' }}
      </button>
    </section>

    <!-- 2. Provisioning -->
    <section class="card">
      <h2 class="section-title">2 · Device Provisioning (Bluetooth)</h2>
      <div class="field">
        <label for="ssid">WiFi SSID</label>
        <input id="ssid" v-model="ssid" placeholder="Enter WiFi name" autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">WiFi Password</label>
        <div class="password-field">
          <input
            id="password"
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="Enter WiFi password"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="password-toggle"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
          >
            {{ showPassword ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>
      <button class="btn" @click="provision" :disabled="!registrationToken || isLoading">
        {{ isLoading ? 'Provisioning…' : 'Provision Device' }}
      </button>

      <div v-if="provisioningEvents.length" class="provisioning-log">
        <div class="provisioning-log-title">Provisioning status</div>
        <div
          v-for="(event, i) in provisioningEventGroups"
          :key="`${event.stage}-${event.source}-${i}`"
          class="provisioning-event"
          :class="`status-${event.status}`"
        >
          <div class="provisioning-event-main">
            <span>{{ event.stage }}</span>
            <span>
              {{ event.status }}
              <span v-if="event.count > 1" class="provisioning-count">
                x{{ event.count }}
              </span>
            </span>
          </div>
          <div class="provisioning-event-message">{{ event.message }}</div>
          <div
            v-if="
              event.stage === 'token' &&
              event.source === 'sdk' &&
              event.chunkIndex &&
              event.chunkTotal
            "
            class="provisioning-progress"
          >
            <div :style="{ width: `${(event.chunkIndex / event.chunkTotal) * 100}%` }"></div>
          </div>
          <div class="provisioning-event-meta">
            {{ event.source }}
            <template v-if="event.code !== undefined"> · code {{ event.code }}</template>
            <template v-if="event.rawValue?.length">
              · raw [{{ event.rawValue.join(', ') }}]
            </template>
          </div>
        </div>
      </div>

      <template v-if="deviceData">
        <h3 style="margin: 20px 0 8px; font-size: 14px">Device Data</h3>
        <pre class="code">{{ JSON.stringify(deviceData, null, 2) }}</pre>
      </template>
    </section>

    <!-- 3. Control -->
    <section v-if="registrationToken" class="card">
      <h2 class="section-title">3 · Device Control</h2>

      <div class="subcard">
        <h3>
          <span class="dot" :class="isConnected ? 'dot-on' : 'dot-off'"></span>
          Connection
        </h3>
        <div class="btn-row">
          <button v-if="isConnected" class="btn btn-danger" @click="disconnect">Disconnect</button>
          <button v-else class="btn" @click="connect" :disabled="isLoading">
            {{ isLoading ? 'Connecting…' : 'Connect to Server' }}
          </button>
        </div>

        <template v-if="isConnected && deviceStatuses.length">
          <div
            v-for="(status, i) in deviceStatuses"
            :key="i"
            class="status-grid"
          >
            <div v-for="[k, v] in Object.entries(status)" :key="k" class="status-item">
              <div class="k">{{ k }}</div>
              <div class="v">{{ v }}</div>
            </div>
          </div>
        </template>
        <p v-else-if="isConnected" class="muted" style="margin-top: 10px">Waiting for device status…</p>
      </div>

      <div class="subcard">
        <h3>Movement</h3>
        <div class="control-row">
          <div class="field num">
            <label for="ms">Speed</label>
            <input id="ms" type="number" v-model.number="moveSpeed" min="0" max="100" step="1" />
          </div>
          <div class="field num">
            <label for="mp">Position</label>
            <input id="mp" type="number" v-model.number="movePosition" min="0" max="100" step="1" />
          </div>
          <button class="btn grow" @click="manager?.moveTo(moveSpeed, movePosition)" :disabled="!isConnected">
            Move To
          </button>
        </div>
        <div class="control-row">
          <div class="field num">
            <label for="mbs">Speed</label>
            <input id="mbs" type="number" v-model.number="mbSpeed" min="0" max="100" step="1" />
          </div>
          <div class="field num">
            <label for="mbmin">Min</label>
            <input id="mbmin" type="number" v-model.number="mbMin" min="0" max="100" step="1" />
          </div>
          <div class="field num">
            <label for="mbmax">Max</label>
            <input id="mbmax" type="number" v-model.number="mbMax" min="0" max="100" step="1" />
          </div>
          <button
            class="btn grow"
            @click="manager?.movementBetween(mbSpeed, mbMin, mbMax)"
            :disabled="!isConnected"
          >
            Move Between
          </button>
        </div>
        <div class="btn-row">
          <button class="btn btn-danger" @click="manager?.stop()" :disabled="!isConnected">
            Stop All Movement
          </button>
        </div>
      </div>

      <div class="subcard">
        <h3>Settings</h3>
        <div class="control-row">
          <div class="field num">
            <label for="int">Intensity</label>
            <input id="int" type="number" v-model.number="intensity" min="0" max="10" step="1" />
          </div>
          <button class="btn grow" @click="manager?.setIntensity(intensity)" :disabled="!isConnected">
            Set Intensity
          </button>
        </div>
        <div class="control-row">
          <div class="field num">
            <label for="si">Status interval (s)</label>
            <input id="si" type="number" v-model.number="statusInterval" min="0" max="10" step="1" />
          </div>
          <button
            class="btn grow"
            @click="manager?.setStatusInterval(statusInterval)"
            :disabled="!isConnected"
          >
            Set Interval
          </button>
        </div>
        <div class="btn-row">
          <button class="btn btn-secondary" @click="manager?.forceStatusReport()" :disabled="!isConnected">
            Force Status Report
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
