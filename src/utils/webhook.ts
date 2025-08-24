import axios from 'axios';
import { Alert } from '../types/monitoring';
import config from '../config';
import logger from './logger';

interface WebhookNotificationParams {
  url: string;
  alert: Alert;
}

/**
 * Send a notification to a webhook endpoint
 */
export async function sendWebhookNotification(params: WebhookNotificationParams): Promise<void> {
  if (!config.monitoring.alerts.webhook.enabled || !config.monitoring.alerts.webhook.url) {
    return;
  }

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      source: 'rinawarp-analytics',
      alert: {
        id: params.alert.id,
        level: params.alert.level,
        title: params.alert.title,
        message: params.alert.message,
        metadata: params.alert.metadata || {},
        createdAt: params.alert.createdAt
      }
    };

    // Add signature if configured
    const signature = createSignature(payload);
    const headers = signature ? { 'X-Signature': signature } : {};

    // Send to webhook
    await axios.post(params.url, payload, { headers });
  } catch (error) {
    logger.error('Failed to send webhook notification:', error);
  }
}

/**
 * Create a signature for webhook payload if secret is configured
 */
function createSignature(payload: any): string | null {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return null;
  }

  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}
