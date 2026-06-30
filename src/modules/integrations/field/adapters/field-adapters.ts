import type { FieldAdapter } from '../field-adapter.types';
import { liveFieldPoll, liveFieldTest } from './live-field.util';

const baseAdapter = (
  kind: FieldAdapter['kind'],
  label: string,
  supportedTelemetry: FieldAdapter['supportedTelemetry'],
): FieldAdapter => ({
  kind,
  label,
  supportedTelemetry,
  async testConnection(ctx) {
    return liveFieldTest(ctx, label);
  },
  async poll(ctx) {
    return liveFieldPoll(ctx);
  },
  normalizeIngress(raw) {
    const deviceId = String(raw.deviceId || raw.device_id || 'unknown');
    const telemetryType = String(raw.telemetryType || raw.type || supportedTelemetry[0]) as FieldAdapter['supportedTelemetry'][number];
    if (!supportedTelemetry.includes(telemetryType)) return null;
    return {
      deviceId,
      deviceName: raw.deviceName as string | undefined,
      telemetryType,
      payload: (raw.payload as Record<string, unknown>) || raw,
      recordedAt: raw.recordedAt ? new Date(String(raw.recordedAt)) : new Date(),
    };
  },
});

export const gpsAdapter = baseAdapter('gps', 'GPS Fleet Tracker', ['location', 'engine_hours', 'equipment_status']);

export const rfidAdapter = baseAdapter('rfid', 'RFID Gateway', ['location', 'attendance', 'equipment_status']);

export const biometricAdapter = baseAdapter('biometric', 'Biometric Terminal', ['attendance']);

export const fuelSensorAdapter = baseAdapter('fuel_sensor', 'Fuel Sensor Hub', ['fuel', 'equipment_status']);

export const iotAdapter = baseAdapter('iot', 'IoT Sensor Hub', ['location', 'fuel', 'equipment_status', 'engine_hours']);

export const oemAdapter = baseAdapter('oem', 'OEM Telematics', ['location', 'engine_hours', 'fuel', 'equipment_status']);
