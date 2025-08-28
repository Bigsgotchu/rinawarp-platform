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
      'Access to GPT-5, Claude 4.1, & Gemini 2.5',
      '150 AI requests/month',
      '3 indexed codebases (5,000 files each)',
      'Basic terminal features',
      'Up to 3 custom themes',
      'Community support',
      'Zero data retention option',
    ],
    ctaText: 'Download Free',
    ctaLink: '/download',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    period: 'month',
    description: 'For developers using AI to code, debug, and troubleshoot',
    features: [
      'Everything in Free, plus:',
      '2,500 AI requests/month',
      '40 indexed codebases (10,000 files each)',
      'Pay-as-you-go AI overages',
      'All premium AI models + Groq integration',
      'Unlimited themes & customization',
      'Private email support',
      'Advanced zero data retention',
      '$120/year if paid annually',
    ],
    isPopular: true,
    ctaText: 'Get Started',
    ctaLink: '/signup?plan=pro',
  },
  {
    id: 'turbo',
    name: 'Turbo',
    price: '$35',
    period: 'month',
    description: 'For developers using AI as a daily productivity driver',
    features: [
      'Everything in Pro, plus:',
      '10,000 AI requests/month',
      '40 indexed codebases (20,000 files each)',
      'Ultra-fast Groq response speed',
      'Unlimited fallback model usage',
      'Priority support & training',
      'Custom API integrations',
      '$336/year if paid annually',
    ],
    isPopular: true,
    ctaText: 'Start Free Trial',
    ctaLink: '/signup?plan=turbo',
  },
  {
    id: 'business',
    name: 'Business',
    price: '$49',
    period: 'user/month',
    description: 'For teams scaling AI-powered development',
    features: [
      'Everything in Turbo, plus:',
      '10,000 AI requests/month per user',
      'Team-wide zero data retention',
      'SAML-based SSO',
      'Bring your own LLM option',
      'Dedicated Slack support',
      'Custom security controls',
      '$468/year if paid annually',
    ],
    ctaText: 'Start Free Trial',
    ctaLink: '/signup?plan=business',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For organizations with security and compliance requirements',
    features: [
      'Everything in Business, plus:',
      'Custom AI & indexing limits',
      'Enterprise SLA guarantee',
      'Advanced compliance features',
      'Custom LLM deployment options',
      'Dedicated success manager',
      'Priority feature development',
    ],
    ctaText: 'Contact Sales',
    ctaLink: '/contact?plan=enterprise',
  },
];
