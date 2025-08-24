export default {
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    thresholds: {
      slowDeliveryMs: parseInt(process.env.SLOW_DELIVERY_THRESHOLD_MS || '10000'), // 10 seconds
      failureRate: parseFloat(process.env.FAILURE_RATE_THRESHOLD || '0.05'), // 5%
    },
    alerts: {
      slack: {
        enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#monitoring'
      },
      email: {
        enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
        recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean)
      },
      webhook: {
        enabled: process.env.WEBHOOK_ALERTS_ENABLED === 'true',
        url: process.env.ALERT_WEBHOOK_URL
      }
    },
    opentelemetry: {
      enabled: process.env.OPENTELEMETRY_ENABLED === 'true',
      endpoint: process.env.OPENTELEMETRY_ENDPOINT,
      serviceName: process.env.OPENTELEMETRY_SERVICE_NAME || 'rinawarp-analytics'
    }
  },
  security: {
    unsubscribeSecret: process.env.UNSUBSCRIBE_SECRET || 'your-secret-key-here',
  },
  email: {
    from: 'RinaWarp Terminal <support@rinawarptech.com>'
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD
    },
    assets: {
      logoUrl: process.env.EMAIL_LOGO_URL || 'https://rinawarp.com/assets/logo.png'
    }
  },
  analytics: {
    reports: {
      daily: {
        enabled: process.env.DAILY_REPORTS_ENABLED === 'true',
        time: process.env.DAILY_REPORTS_TIME || '06:00'
      },
      weekly: {
        enabled: process.env.WEEKLY_REPORTS_ENABLED === 'true',
        time: process.env.WEEKLY_REPORTS_TIME || '07:00',
        day: parseInt(process.env.WEEKLY_REPORTS_DAY || '1') // Monday
      },
      monthly: {
        enabled: process.env.MONTHLY_REPORTS_ENABLED === 'true',
        time: process.env.MONTHLY_REPORTS_TIME || '08:00',
        day: parseInt(process.env.MONTHLY_REPORTS_DAY || '1') // 1st of month
      }
    }
  },
  appUrl: process.env.APP_URL || 'https://rinawarptech.com',
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
    trackingId: process.env.ANALYTICS_TRACKING_ID,
    features: {
      pricing: {
        enabled: true,
        events: {
          pageView: 'pricing_page_view',
          planSelect: 'pricing_plan_selected',
          checkout: 'pricing_checkout_started'
        }
      }
    }
  }
};
