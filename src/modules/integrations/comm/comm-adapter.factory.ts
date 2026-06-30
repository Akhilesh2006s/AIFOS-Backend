import type { CommAdapter, CommChannel } from './comm-adapter.types';
import { emailAdapter, slackAdapter, smsAdapter, teamsAdapter, whatsappAdapter } from './adapters/comm-adapters';

const BY_REGISTRY: Record<string, CommAdapter> = {
  'smtp-email': emailAdapter,
  'sms-gateway': smsAdapter,
  'whatsapp-business': whatsappAdapter,
  'ms-teams': teamsAdapter,
  slack: slackAdapter,
};

const BY_CHANNEL: Record<CommChannel, CommAdapter> = {
  email: emailAdapter,
  sms: smsAdapter,
  whatsapp: whatsappAdapter,
  teams: teamsAdapter,
  slack: slackAdapter,
};

export function getCommAdapter(registryId: string): CommAdapter | null {
  return BY_REGISTRY[registryId] || null;
}

export function getCommAdapterByChannel(channel: CommChannel): CommAdapter | null {
  return BY_CHANNEL[channel] || null;
}

export function isCommConnector(registryId: string) {
  return !!BY_REGISTRY[registryId];
}

export function listCommAdapters() {
  return Object.values(BY_REGISTRY).map((a) => ({
    channel: a.channel,
    label: a.label,
    registryId: a.registryId,
    mock: true,
  }));
}

export function renderTemplate(body: string, vars: Record<string, unknown>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}
