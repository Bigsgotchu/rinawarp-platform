import { PrismaClient, BillingInterval } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create subscription tiers
  const tiers = [
    {
      name: 'Free',
      description: 'Basic access with limited features',
      price: 0,
      currency: 'usd',
      interval: 'MONTHLY' as BillingInterval,
      features: {
        apiRequests: 1000,
        promptTokens: 10000,
        completionTokens: 10000,
      },
      active: true,
    },
    {
      name: 'Pro',
      description: 'Professional features with higher limits',
      price: 9.99,
      currency: 'usd',
      interval: 'MONTHLY' as BillingInterval,
      features: {
        apiRequests: 10000,
        promptTokens: 100000,
        completionTokens: 100000,
        priority: true,
      },
      active: true,
    },
    {
      name: 'Enterprise',
      description: 'Enterprise-grade features with unlimited access',
      price: 49.99,
      currency: 'usd',
      interval: 'MONTHLY' as BillingInterval,
      features: {
        apiRequests: -1, // unlimited
        promptTokens: -1, // unlimited
        completionTokens: -1, // unlimited
        priority: true,
        support: '24/7',
      },
      active: true,
    },
  ];

  console.log('Creating subscription tiers...');
  for (const tier of tiers) {
    const existing = await prisma.subscriptionTier.findFirst({ where: { name: tier.name } });
    if (existing) {
      await prisma.subscriptionTier.update({ where: { id: existing.id }, data: tier });
    } else {
      await prisma.subscriptionTier.create({ data: tier });
    }
  }
  console.log('Subscription tiers created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
