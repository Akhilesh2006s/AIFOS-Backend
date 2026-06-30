export type CommChannel = 'email' | 'sms' | 'whatsapp' | 'teams' | 'slack';

export interface CommSendContext {
  connectorId: string;
  channel: CommChannel;
  config: Record<string, unknown>;
  authConfig: Record<string, unknown>;
  recipient: string;
  subject?: string;
  body: string;
}

export interface CommSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  latencyMs: number;
}

export interface CommAdapter {
  channel: CommChannel;
  label: string;
  registryId: string;
  send(ctx: CommSendContext): Promise<CommSendResult>;
  testConnection(ctx: Omit<CommSendContext, 'recipient' | 'subject' | 'body'>): Promise<{ ok: boolean; message: string; latencyMs: number }>;
}
