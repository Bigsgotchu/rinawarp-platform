export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  ctaLink: string;
}

export const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out RinaWarp Terminal',
    features: [
      'FREE Groq AI integration',
      '50 AI requests/day',
      'Basic terminal features',
      '3 custom themes',
      'Community support',
    ],
    ctaText: 'Download Free',
    ctaLink: '/download',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Contact Us',
    period: 'month',
    description: 'For professional developers who need more power',
    features: [
      'Unlimited AI requests',
      'Priority support',
      'Advanced terminal features',
      'Custom themes',
      'API access',
      'Private hosting options',
    ],
    isPopular: true,
    ctaText: 'Contact Sales',
    ctaLink: '/contact',
  },
  {
    id: 'team',
    name: 'Team',
    price: 'Contact Us',
    period: 'month',
    description: 'For development teams and organizations',
    features: [
      'Everything in Pro',
      'Team management',
      'Usage analytics',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated support',
    ],
    ctaText: 'Contact Sales',
    ctaLink: '/contact',
  },
];
