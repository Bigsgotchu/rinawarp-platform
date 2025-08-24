import express from 'express';
import { PrismaClient } from '@prisma/client';
import { userAuth } from '../../middleware/user-auth';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// Schema for updating email preferences
const updatePreferencesSchema = z.object({
  weeklyReports: z.boolean().optional(),
  monthlyReports: z.boolean().optional(),
  usageAlerts: z.boolean().optional(),
  alertThreshold: z.number().min(50).max(95).optional(),
  marketingEmails: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  reportTime: z.string().datetime().optional(),
  timeZone: z.string().optional()
});

// Get user's email preferences
router.get('/', userAuth, async (req, res) => {
  try {
    const preferences = await prisma.emailPreferences.findUnique({
      where: { userId: req.user.id },
    });

    // If no preferences exist, create default ones
    if (!preferences) {
      const defaults = await prisma.emailPreferences.create({
        data: {
          userId: req.user.id
        }
      });
      return res.json(defaults);
    }

    res.json(preferences);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch email preferences',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Update email preferences
router.patch('/', userAuth, async (req, res) => {
  try {
    const updates = updatePreferencesSchema.parse(req.body);

    // Update or create preferences
    const preferences = await prisma.emailPreferences.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        ...updates
      },
      update: updates
    });

    // If updating report time or time zone, update scheduled tasks
    if (updates.reportTime || updates.timeZone) {
      // Re-schedule automated emails for this user
      // This would be implemented in your automated email service
    }

    res.json({
      message: 'Email preferences updated successfully',
      preferences
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input',
        details: error.errors
      });
    }

    res.status(500).json({
      error: 'Failed to update email preferences',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Unsubscribe from specific type of email
router.post('/unsubscribe/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { token } = req.query;

    // Verify unsubscribe token
    // This would be implemented in your email service
    const userId = ''; // Get from token

    const updates: any = {};
    switch (type) {
      case 'weekly':
        updates.weeklyReports = false;
        break;
      case 'monthly':
        updates.monthlyReports = false;
        break;
      case 'alerts':
        updates.usageAlerts = false;
        break;
      case 'marketing':
        updates.marketingEmails = false;
        break;
      case 'all':
        updates.weeklyReports = false;
        updates.monthlyReports = false;
        updates.usageAlerts = false;
        updates.marketingEmails = false;
        break;
      default:
        return res.status(400).json({ error: 'Invalid email type' });
    }

    await prisma.emailPreferences.update({
      where: { userId },
      data: updates
    });

    res.json({
      message: `Successfully unsubscribed from ${type} emails`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process unsubscribe request',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
