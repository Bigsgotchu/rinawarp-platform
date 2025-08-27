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
    price: '$19',
    period: 'month',
    description: 'For professional developers who need more power',
    features: [
      'Unlimited AI requests',
      'Priority support',
      'All terminal features',
      'Custom themes',
      'API access',
      'Up to 5 team members',
      '$190/year if paid annually',
    ],
    isPopular: true,
    ctaText: 'Get Started',
    ctaLink: '/signup?plan=pro',
  },
  {
    id: 'team',
    name: 'Team',
    price: '$49',
    period: 'user/month',
    description: 'For development teams and organizations',
    features: [
      'Everything in Pro',
      'SSO integration',
      'Advanced analytics',
      'Custom integrations',
      'SLA guarantee',
      'Dedicated support manager',
      'Custom feature development',
      'Minimum 5 users',
    ],
    ctaText: 'Contact Sales',
    ctaLink: '/contact?plan=team',
  },
];
