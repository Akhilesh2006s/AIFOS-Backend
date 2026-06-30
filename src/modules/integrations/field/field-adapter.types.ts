export type FieldDeviceKind = 'gps' | 'rfid' | 'biometric' | 'fuel_sensor' | 'iot' | 'oem';

export type TelemetryType = 'location' | 'engine_hours' | 'fuel' | 'equipment_status' | 'attendance';

export interface FieldAdapterContext {
  connectorId: string;
  connectorName: string;
  registryId: string;
  config: Record<string, unknown>;
  authConfig: Record<string, unknown>;
  devices: Array<{ deviceId: string; name: string; assetId?: string; projectId?: string }>;
  telemetryTypes: TelemetryType[];
}

export interface TelemetryReading {
  deviceId: string;
  deviceName?: string;
  telemetryType: TelemetryType;
  payload: Record<string, unknown>;
  recordedAt?: Date;
}

export interface FieldPollResult {
  readings: TelemetryReading[];
  devicesOnline: number;
  devicesTotal: number;
  durationMs: number;
}

export interface FieldAdapter {
  kind: FieldDeviceKind;
  label: string;
  supportedTelemetry: TelemetryType[];
  testConnection(ctx: FieldAdapterContext): Promise<{ ok: boolean; message: string; latencyMs: number }>;
  poll(ctx: FieldAdapterContext): Promise<FieldPollResult>;
  normalizeIngress(raw: Record<string, unknown>): TelemetryReading | null;
}
