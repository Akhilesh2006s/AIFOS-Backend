import * as crypto from 'crypto';
import type { CommAdapter, CommChannel, CommSendContext, CommSendResult } from '../comm-adapter.types';
import { deliverHttp, buildAuthHeaders, resolveEndpoint } from '../../../../common/utils/http-delivery.util';

function liveSend(channel: CommChannel): (ctx: CommSendContext) => Promise<CommSendResult> {
  return async (ctx) => {
    const url = resolveEndpoint(ctx.config, '/messages') || resolveEndpoint(ctx.config);
    if (!url) {
      return { success: false, error: `${channel} endpoint not configured (set apiUrl or webhookUrl in connector config)`, latencyMs: 0 };
    }
    const headers = buildAuthHeaders(
      (ctx.authConfig.authType as string) || 'api_key',
      ctx.authConfig as Record<string, unknown>,
    );
    const result = await deliverHttp({
      url,
      method: 'POST',
      payload: {
        channel,
        recipient: ctx.recipient,
        subject: ctx.subject,
        body: ctx.body,
        connectorId: ctx.connectorId,
      },
      headers,
    });
    return {
      success: result.success,
      messageId: result.success ? `${channel}-${crypto.randomUUID()}` : undefined,
      error: result.error,
      latencyMs: result.responseTimeMs,
    };
  };
}

function liveTest(label: string) {
  return async (ctx: Omit<CommSendContext, 'recipient' | 'subject' | 'body'>) => {
    const url = resolveEndpoint(ctx.config, '/health') || resolveEndpoint(ctx.config);
    if (!url) {
      return { ok: false, message: `${label} endpoint not configured`, latencyMs: 0 };
    }
    const headers = buildAuthHeaders(
      (ctx.authConfig.authType as string) || 'api_key',
      ctx.authConfig as Record<string, unknown>,
    );
    const result = await deliverHttp({ url, method: 'GET', headers });
    return {
      ok: result.success,
      message: result.success ? `Connected to ${label}` : (result.error || 'Connection failed'),
      latencyMs: result.responseTimeMs,
    };
  };
}

export const emailAdapter: CommAdapter = {
  channel: 'email',
  label: 'Email (SMTP/API)',
  registryId: 'smtp-email',
  send: liveSend('email'),
  testConnection: liveTest('Email'),
};

export const smsAdapter: CommAdapter = {
  channel: 'sms',
  label: 'SMS Gateway',
  registryId: 'sms-gateway',
  send: liveSend('sms'),
  testConnection: liveTest('SMS'),
};

export const whatsappAdapter: CommAdapter = {
  channel: 'whatsapp',
  label: 'WhatsApp Business',
  registryId: 'whatsapp-business',
  send: liveSend('whatsapp'),
  testConnection: liveTest('WhatsApp'),
};

export const teamsAdapter: CommAdapter = {
  channel: 'teams',
  label: 'Microsoft Teams',
  registryId: 'ms-teams',
  send: liveSend('teams'),
  testConnection: liveTest('Teams'),
};

export const slackAdapter: CommAdapter = {
  channel: 'slack',
  label: 'Slack',
  registryId: 'slack',
  send: liveSend('slack'),
  testConnection: liveTest('Slack'),
};
