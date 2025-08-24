/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { unsubscribeHandler } from '../../services/unsubscribe-handler';

const router = express.Router();
const prisma = new PrismaClient();

// Verify SendGrid webhook signature
const verifyWebhook = (req: express.Request): boolean => {
  const signature = req.header('X-Twilio-Email-Event-Webhook-Signature');
  const timestamp = req.header('X-Twilio-Email-Event-Webhook-Timestamp');
  
  if (!signature || !timestamp) {
    return false;
  }

  // Implement signature verification here using your webhook signing key
  // https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
  return true; // TODO: Implement actual verification
};

// Map SendGrid event types to our EmailEventType enum
const mapEventType = (eventType: string): 'BOUNCE' | 'OPEN' | 'CLICK' | 'SPAM_REPORT' | 'UNSUBSCRIBE' => {
  const typeMap: Record<string, any> = {
    'bounce': 'BOUNCE',
    'opened': 'OPEN',
    'click': 'CLICK',
    'spamreport': 'SPAM_REPORT',
    'unsubscribe': 'UNSUBSCRIBE',
    'group_unsubscribe': 'UNSUBSCRIBE'
  };
  return typeMap[eventType] || 'BOUNCE';
};

// Handle SendGrid webhook events
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature
    if (!verifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const events = JSON.parse(req.body.toString());

    // Process each event
    for (const event of events) {
      const { email, event: eventType, timestamp, ...metadata } = event;

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) continue;

      // Log the event
      await prisma.emailEvent.create({
        data: {
          userId: user.id,
          type: mapEventType(eventType),
          email,
          metadata: {
            timestamp,
            ...metadata
          }
        }
      });

      // Handle specific events
      switch (eventType) {
        case 'bounce':
        case 'spamreport':
          await unsubscribeHandler.handleBounce(
            email,
            eventType === 'bounce' ? metadata.reason : 'spam_report'
          );
          break;

        case 'group_unsubscribe':
        case 'unsubscribe':
          await unsubscribeHandler.handleUnsubscribe(
            user.id,
            'all'
          );
          break;
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
