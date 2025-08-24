/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

import { Router } from 'express';
import { EmailTemplate, emailService } from '../services/email';

const router = Router();

// Test endpoint - only available in development
router.post('/api/_dev/test-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { email, template = 'USAGE_WARNING' } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Sample data for testing
    const testData = {
      name: 'Test User',
      usagePercent: 85,
      planName: 'Professional',
      used: 850,
      limit: 1000,
      resetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      upgradeUrl: `${process.env.FRONTEND_URL}/dashboard/upgrade`,
      usageUrl: `${process.env.FRONTEND_URL}/dashboard/usage`
    };

    await emailService.sendTemplateEmail(
      email,
      template as EmailTemplate,
      testData
    );

    res.json({ 
      success: true,
      message: `Test email sent to ${email}`,
      template,
      data: testData
    });
  } catch (error) {
    console.error('Failed to send test email:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Test all email templates
router.post('/api/_dev/test-all-templates', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const results = [];
    const templates = Object.values(EmailTemplate);

    for (const template of templates) {
      // Sample data customized for each template
      const testData = {
        name: 'Test User',
        usagePercent: 85,
        planName: 'Professional',
        used: 850,
        limit: 1000,
        resetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        upgradeUrl: `${process.env.FRONTEND_URL}/dashboard/upgrade`,
        usageUrl: `${process.env.FRONTEND_URL}/dashboard/usage`,
        // Payment specific data
        paymentAmount: 29,
        paymentDate: new Date().toLocaleDateString(),
        cardLast4: '4242',
        retryUrl: `${process.env.FRONTEND_URL}/billing/retry`,
        // Welcome specific data
        docsUrl: `${process.env.FRONTEND_URL}/docs`,
        supportUrl: `${process.env.FRONTEND_URL}/support`,
        // Subscription specific data
        oldPlan: 'Free',
        newPlan: 'Professional',
        effectiveDate: new Date().toLocaleDateString(),
        features: [
          'Increased API limits',
          'Priority support',
          'Advanced analytics'
        ]
      };

      try {
        await emailService.sendTemplateEmail(email, template, testData);
        results.push({
          template,
          status: 'success'
        });
      } catch (error) {
        results.push({
          template,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Add delay between emails
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.json({
      success: true,
      message: `Test emails sent to ${email}`,
      results
    });
  } catch (error) {
    console.error('Failed to send test emails:', error);
    res.status(500).json({
      error: 'Failed to send test emails',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
