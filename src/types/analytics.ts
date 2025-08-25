export type ReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TEST';

export interface AnalyticsReportConfig {
  enabled: boolean;
  schedule: string;
  recipients?: string[];
}

export interface AnalyticsConfig {
  enabled: boolean;
  trackingId?: string;
  features: {
    pricing: {
      enabled: boolean;
      events: {
        pageView: string;
        planSelect: string;
        checkout: string;
      };
    };
  };
  reports: {
    daily: AnalyticsReportConfig;
    weekly: AnalyticsReportConfig;
    monthly: AnalyticsReportConfig;
  };
}
