import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validateRequest } from '../middleware/validate';
import { trackEvent } from '../lib/analytics';

const router = Router();

const downloadSchema = z.object({
  platform: z.enum(['macos', 'windows', 'linux']),
  version: z.string(),
  url: z.string().url(),
});

const updateDownloadSchema = z.object({
  platform: z.enum(['macos', 'windows', 'linux']),
  version: z.string(),
  url: z.string().url(),
});

// Track download event
router.post('/track', validateRequest(downloadSchema), async (req, res) => {
  const { platform, version } = req.body;
  
  try {
    // Track in database
    await prisma.download.create({
      data: {
        platform,
        version,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        referer: req.headers.referer,
      },
    });

    // Track analytics event
    await trackEvent('app_download', {
      platform,
      version,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Download tracking error:', error);
    res.status(500).json({ error: 'Failed to track download' });
  }
});

// Update download URL
router.post('/update', validateRequest(updateDownloadSchema), async (req, res) => {
  const { platform, version, url } = req.body;
  
  try {
    await prisma.downloadUrl.upsert({
      where: {
        platform_version: {
          platform,
          version,
        },
      },
      update: {
        url,
      },
      create: {
        platform,
        version,
        url,
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Download URL update error:', error);
    res.status(500).json({ error: 'Failed to update download URL' });
  }
});

// Get download stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await prisma.download.groupBy({
      by: ['platform', 'version'],
      _count: true,
      orderBy: {
        _count: {
          platform: 'desc',
        },
      },
    });

    res.status(200).json(stats);
  } catch (error) {
    console.error('Download stats error:', error);
    res.status(500).json({ error: 'Failed to fetch download stats' });
  }
});

export default router;
