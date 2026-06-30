import type { FieldAdapter, FieldDeviceKind } from './field-adapter.types';
import { biometricAdapter, fuelSensorAdapter, gpsAdapter, iotAdapter, oemAdapter, rfidAdapter } from './adapters/field-adapters';

const REGISTRY_TO_KIND: Record<string, FieldDeviceKind> = {
  'gps-fleet': 'gps',
  'rfid-gateway': 'rfid',
  'biometric-terminal': 'biometric',
  'fuel-sensor': 'fuel_sensor',
  'iot-sensor-hub': 'iot',
  'oem-telematics': 'oem',
};

const ADAPTERS: Record<FieldDeviceKind, FieldAdapter> = {
  gps: gpsAdapter,
  rfid: rfidAdapter,
  biometric: biometricAdapter,
  fuel_sensor: fuelSensorAdapter,
  iot: iotAdapter,
  oem: oemAdapter,
};

export function resolveFieldKind(registryId: string): FieldDeviceKind | null {
  return REGISTRY_TO_KIND[registryId] || null;
}

export function getFieldAdapter(registryId: string): FieldAdapter | null {
  const kind = resolveFieldKind(registryId);
  return kind ? ADAPTERS[kind] : null;
}

export function isFieldConnector(registryId: string) {
  return !!resolveFieldKind(registryId);
}

export function listFieldAdapters() {
  return Object.values(ADAPTERS).map((a) => ({
    kind: a.kind,
    label: a.label,
    supportedTelemetry: a.supportedTelemetry,
    mock: true,
  }));
}
