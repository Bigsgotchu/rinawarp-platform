import express from 'express';
import { automatedEmailService } from '../../services/automated-emails';
import { adminAuth } from '../../middleware/admin-auth';

const router = express.Router();

// Admin endpoint to manually trigger reports
router.post('/trigger-report', adminAuth, async (req, res) => {
  try {
    const { type } = req.body;
    
    switch (type) {
      case 'daily':
        await automatedEmailService.checkUsageLimits();
        break;
      case 'weekly':
        await automatedEmailService.sendWeeklyReports();
        break;
      case 'monthly':
        await automatedEmailService.sendMonthlySummaries();
        break;
      default:
        return res.status(400).json({ 
          error: 'Invalid report type',
          validTypes: ['daily', 'weekly', 'monthly']
        });
    }

    res.json({ 
      success: true,
      message: `${type} report triggered successfully`
    });
  } catch (error) {
    res.status(500).json({ 
      error: `Failed to trigger ${req.body.type} report`,
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
