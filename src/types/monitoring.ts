export type AlertLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export type AlertChannel = 'slack' | 'email' | 'webhook';

export interface EmailDeliveryRecord {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  status: 'SUCCESS' | 'FAILURE';
  recipientCount: number;
  deliveryTimeMs?: number;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface DeliveryHealth {
  healthy: boolean;
  stats: {
    totalDeliveries: number;
    failures: number;
    failureRate: number;
    averageDeliveryTime?: number;
  };
}
