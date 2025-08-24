/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import express from 'express';
import { emailService, EmailTemplate } from '../services/email';

const router = express.Router();

// Resolve template input (accepts enum key or value, case-insensitive)
function resolveTemplate(input: unknown): EmailTemplate {
  if (typeof input !== 'string') {
    throw new Error('Invalid template');
  }

  // Try enum key (e.g., "USAGE_WARNING")
  if (Object.prototype.hasOwnProperty.call(EmailTemplate, input)) {
    return (EmailTemplate as any)[input] as EmailTemplate;
  }

  // Try enum value (e.g., "usage_warning"), case-insensitive match
  const match = (Object.values(EmailTemplate) as string[]).find(
    v => v.toLowerCase() === input.toLowerCase()
  );
  if (match) return match as EmailTemplate;

  throw new Error(`Template ${input} not found`);
}

// Check admin test token
const checkTestToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const testToken = process.env.EMAIL_TEST_TOKEN;
  if (!testToken) {
    return res.status(403).json({ error: 'Test endpoint not configured' });
  }

  const authHeader = req.header('X-Test-Token');
  if (authHeader !== testToken) {
    return res.status(401).json({ error: 'Invalid test token' });
  }

  next();
};

// Protected test email endpoint
router.post('/test-email', checkTestToken, async (req, res) => {
  try {
    const { email, template, data } = req.body;
    const resolved = resolveTemplate(template);
    await emailService.sendTemplateEmail(email, resolved, data || {});
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending test email:', message);
    res.status(400).json({ error: message });
  }
});

export default router;
