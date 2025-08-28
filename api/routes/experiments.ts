import express from 'express';
import { ABTestingService } from '@rinawarp/core';
import { userAuth } from '../middleware/user-auth';
import { adminAuth } from '../middleware/admin-auth';
import { rateLimit } from '../middleware/rate-limit';

const router = express.Router();
const abTestingService = ABTestingService.getInstance();

// Get all experiments (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const experiments = await abTestingService.getAllExperiments();
    res.json(experiments);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch experiments',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Create new experiment (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const experiment = await abTestingService.createExperiment(req.body);
    res.json(experiment);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create experiment',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get experiment details (admin only)
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const experiment = await abTestingService.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }
    res.json(experiment);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch experiment',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Update experiment (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const experiment = await abTestingService.updateExperiment(req.params.id, req.body);
    res.json(experiment);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update experiment',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Delete experiment (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await abTestingService.deleteExperiment(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete experiment',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get experiment results (admin only)
router.get('/:id/results', adminAuth, async (req, res) => {
  try {
    const results = await abTestingService.getExperimentResults(req.params.id);
    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch experiment results',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get variant for user
router.post('/:id/variant', userAuth, rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10 // limit each IP to 10 requests per windowMs
}), async (req, res) => {
  try {
    const { context } = req.body;
    const variant = await abTestingService.getVariantForUser(
      req.params.id,
      req.user.id,
      context
    );
    res.json({ variant });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get variant',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Track experiment event
router.post('/:id/events', userAuth, rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // limit each IP to 100 requests per windowMs
}), async (req, res) => {
  try {
    const { variantId, eventType, eventData } = req.body;
    await abTestingService.trackEvent({
      experimentId: req.params.id,
      variantId,
      userId: req.user.id,
      eventType,
      eventData
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: 'Failed to track event',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
