import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import StripeService from './services/stripe';

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy' });
  }
});

// Public endpoint to list subscription tiers
app.get('/api/subscription-tiers', async (req, res) => {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });
    res.json(tiers);
  } catch (error) {
    console.error('Failed to fetch tiers:', error);
    res.status(500).json({ error: 'Failed to fetch subscription tiers' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
