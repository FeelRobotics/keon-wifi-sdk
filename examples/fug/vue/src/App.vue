<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { FugManager } from '@feelrobotics/keon-wifi-sdk';
import type { KeonDeviceStatus } from '@feelrobotics/keon-wifi-sdk';

// FUG controls an already-provisioned device with only a deviceConnectionKey.
const manager = shallowRef<FugManager | null>(null);
const statuses = ref<KeonDeviceStatus[]>([]);
const error = ref<string | null>(null);
const busy = ref(false);

const dck = ref('');
const pollSec = ref(30);

const speed = ref(50);
const position = ref(50);
const betweenSpeed = ref(50);
const minPos = ref(0);
const maxPos = ref(100);
const intensity = ref(50);
const statusInterval = ref(200);

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
  error.value = null;
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    error.value = String(e);
  } finally {
    busy.value = false;
  }
}

function connect() {
  run(async () => {
    if (!dck.value.trim()) throw new Error('Enter a deviceConnectionKey');
    manager.value = await FugManager.connect({
      deviceConnectionKey: dck.value.trim(),
      statusPollIntervalSec: pollSec.value,
      onStatusChange: (s) => {
        statuses.value = s;
      },
    });
    // The SDK doesn't fetch on connect; pull the initial status ourselves.
    await manager.value.forceStatusReport();
  });
}

async function disconnect() {
  await manager.value?.disconnect();
  manager.value = null;
  statuses.value = [];
}

function need(): FugManager {
  if (!manager.value) throw new Error('Not connected');
  return manager.value;
}

function confirmThen(message: string, fn: () => Promise<void>) {
  if (window.confirm(message)) run(fn);
}
</script>

<template>
  <div class="app">
    <header>
      <h1>Keon FUG Console</h1>
      <span :class="manager ? 'badge on' : 'badge'">
        {{ manager ? 'connected' : 'disconnected' }}
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
        <input v-model="dck" placeholder="DCK" :disabled="!!manager" />
      </label>
      <label>
        status poll (seconds, 0 = off)
        <input type="number" v-model.number="pollSec" :disabled="!!manager" />
      </label>
      <button v-if="manager" @click="disconnect">Disconnect</button>
      <button v-else :disabled="busy" @click="connect">Connect</button>
    </section>

    <section class="card" :data-disabled="!manager">
      <h2>Movement</h2>
      <label class="slider"
        ><span>speed: {{ speed }}</span>
        <input type="range" min="0" max="100" v-model.number="speed"
      /></label>
      <label class="slider"
        ><span>position: {{ position }}</span>
        <input type="range" min="0" max="100" v-model.number="position"
      /></label>
      <button
        :disabled="!manager || busy"
        @click="run(() => need().moveTo(speed, position))"
      >
        Move to
      </button>

      <label class="slider"
        ><span>between speed: {{ betweenSpeed }}</span>
        <input type="range" min="0" max="100" v-model.number="betweenSpeed"
      /></label>
      <label class="slider"
        ><span>min: {{ minPos }}</span>
        <input type="range" min="0" max="100" v-model.number="minPos"
      /></label>
      <label class="slider"
        ><span>max: {{ maxPos }}</span>
        <input type="range" min="0" max="100" v-model.number="maxPos"
      /></label>
      <button
        :disabled="!manager || busy"
        @click="run(() => need().movementBetween(betweenSpeed, minPos, maxPos))"
      >
        Movement between
      </button>

      <button
        class="danger"
        :disabled="!manager || busy"
        @click="run(() => need().stop())"
      >
        Stop
      </button>
    </section>

    <section class="card" :data-disabled="!manager">
      <h2>Settings</h2>
      <label class="slider"
        ><span>intensity %: {{ intensity }}</span>
        <input type="range" min="0" max="100" v-model.number="intensity"
      /></label>
      <button
        :disabled="!manager || busy"
        @click="run(() => need().setIntensity(intensity))"
      >
        Set intensity
      </button>
      <label class="slider"
        ><span>status interval: {{ statusInterval }}</span>
        <input type="range" min="0" max="1000" v-model.number="statusInterval"
      /></label>
      <button
        :disabled="!manager || busy"
        @click="run(() => need().setStatusInterval(statusInterval))"
      >
        Set status interval
      </button>
    </section>

    <section class="card" :data-disabled="!manager">
      <h2>Reprovision</h2>
      <div class="row">
        <button
          class="danger"
          :disabled="!manager || busy"
          @click="
            confirmThen('Drop WiFi and return to Bluetooth mode?', () =>
              need().switchToBtMode()
            )
          "
        >
          Switch to BT mode
        </button>
        <button
          class="danger"
          :disabled="!manager || busy"
          @click="
            confirmThen('Wipe stored WiFi credentials on the device?', () =>
              need().resetCredentials()
            )
          "
        >
          Reset credentials
        </button>
      </div>
    </section>

    <section class="card" :data-disabled="!manager">
      <h2>Status</h2>
      <button
        class="ghost"
        :disabled="!manager || busy"
        @click="run(() => need().forceStatusReport())"
      >
        Force status report
      </button>
      <p v-if="statuses.length === 0" class="hint">
        No status yet — connect to a device.
      </p>
      <template v-else>
        <div
          class="device"
          v-for="(status, i) in statuses"
          :key="status.serial_number || i"
        >
          <h3 v-if="statuses.length > 1">
            {{ status.serial_number || `Device ${i + 1}` }}
          </h3>
          <div class="metrics">
            <div class="metric" v-for="(value, key) in status" :key="key">
              <span class="k">{{ STATUS_LABELS[key] ?? key }}</span>
              <span class="v"
                >{{ value }}<span v-if="STATUS_UNITS[key]" class="u">{{
                  STATUS_UNITS[key]
                }}</span></span
              >
            </div>
          </div>
        </div>
      </template>
    </section>

    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>
