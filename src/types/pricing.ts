export interface PricingFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: string;
}

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: PricingFeature[];
  isPopular?: boolean;
  stripePriceId: string;
}

export interface PriceOption {
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  stripePriceId: string;
  savings?: number;
}

export interface SubscriptionBillingInfo {
  currentPlan: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  priceId: string;
}
