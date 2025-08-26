import axios from 'axios';
import { AlertLevel } from '../types/monitoring';
import config from '../config';
import logger from './logger';

interface SlackNotificationParams {
  channel: string;
  title: string;
  message: string;
  level: AlertLevel;
  metadata?: Record<string, any>;
}

/**
 * Send a notification to Slack
 */
export async function sendSlackNotification(
  params: SlackNotificationParams
): Promise<void> {
  if (
    !config.monitoring.alerts.slack.enabled ||
    !config.monitoring.alerts.slack.webhook
  ) {
    return;
  }

  try {
    // Get emoji and color based on level
    const { emoji, color } = getSlackFormatting(params.level);

    // Format metadata as a string if present
    const metadataText = params.metadata
      ? '\n\n*Additional Details:*\n' +
        Object.entries(params.metadata)
          .map(([key, value]) => `• ${key}: ${JSON.stringify(value)}`)
          .join('\n')
      : '';

    // Construct message payload
    const payload = {
      channel: params.channel,
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${emoji} ${params.title}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: params.message + metadataText,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*Level:* ${params.level} | *Time:* ${new Date().toISOString()}`,
                },
              ],
            },
          ],
        },
      ],
    };

    // Send to Slack
    await axios.post(config.monitoring.alerts.slack.webhook!, payload);
  } catch (error) {
    logger.error('Failed to send Slack notification:', error);
  }
}

/**
 * Get Slack formatting for different alert levels
 */
function getSlackFormatting(level: AlertLevel): {
  emoji: string;
  color: string;
} {
  switch (level) {
    case 'INFO':
      return { emoji: 'ℹ️', color: '#2196F3' };
    case 'WARNING':
      return { emoji: '⚠️', color: '#FFC107' };
    case 'ERROR':
      return { emoji: '🚨', color: '#F44336' };
    case 'CRITICAL':
      return { emoji: '💀', color: '#9C27B0' };
    default:
      return { emoji: '❓', color: '#9E9E9E' };
  }
}
