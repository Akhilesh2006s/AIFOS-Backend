import type { FieldAdapterContext, FieldPollResult, TelemetryReading } from '../field-adapter.types';

export function mockLatency() {
  return 50 + Math.floor(Math.random() * 150);
}

export function mockLocation(deviceId: string, name?: string): TelemetryReading {
  return {
    deviceId,
    deviceName: name,
    telemetryType: 'location',
    payload: {
      lat: 12.97 + Math.random() * 0.1,
      lng: 77.59 + Math.random() * 0.1,
      speed: Math.round(Math.random() * 60),
      heading: Math.round(Math.random() * 360),
    },
    recordedAt: new Date(),
  };
}

export function mockEngineHours(deviceId: string, name?: string): TelemetryReading {
  return {
    deviceId,
    deviceName: name,
    telemetryType: 'engine_hours',
    payload: { hours: Math.round(100 + Math.random() * 5000), idleHours: Math.round(Math.random() * 200) },
    recordedAt: new Date(),
  };
}

export function mockFuel(deviceId: string, name?: string): TelemetryReading {
  return {
    deviceId,
    deviceName: name,
    telemetryType: 'fuel',
    payload: {
      levelPercent: Math.round(20 + Math.random() * 70),
      liters: Math.round(50 + Math.random() * 400),
      consumptionRate: Math.round(Math.random() * 30),
    },
    recordedAt: new Date(),
  };
}

export function mockEquipmentStatus(deviceId: string, name?: string): TelemetryReading {
  const statuses = ['running', 'idle', 'maintenance', 'offline'];
  return {
    deviceId,
    deviceName: name,
    telemetryType: 'equipment_status',
    payload: {
      status: statuses[Math.floor(Math.random() * statuses.length)],
      faultCode: Math.random() > 0.85 ? 'E-102' : null,
      temperature: Math.round(60 + Math.random() * 40),
    },
    recordedAt: new Date(),
  };
}

export function mockAttendance(deviceId: string, name?: string): TelemetryReading {
  return {
    deviceId,
    deviceName: name,
    telemetryType: 'attendance',
    payload: {
      workerId: `WK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      workerName: 'Field Worker',
      checkType: Math.random() > 0.5 ? 'check_in' : 'check_out',
      method: 'biometric',
    },
    recordedAt: new Date(),
  };
}

export function buildPollResult(
  ctx: FieldAdapterContext,
  generators: Array<(deviceId: string, name?: string) => TelemetryReading>,
): FieldPollResult {
  const start = Date.now();
  const readings: TelemetryReading[] = [];
  const devices = ctx.devices.length ? ctx.devices : [{ deviceId: 'default-001', name: 'Default Device' }];
  const allowed = ctx.telemetryTypes.length ? ctx.telemetryTypes : null;

  for (const device of devices) {
    for (const gen of generators) {
      const reading = gen(device.deviceId, device.name);
      if (!allowed || allowed.includes(reading.telemetryType)) {
        readings.push(reading);
      }
    }
  }
  const online = Math.max(1, devices.filter(() => Math.random() > 0.1).length);
  return { readings, devicesOnline: online, devicesTotal: devices.length, durationMs: Date.now() - start + mockLatency() };
}
