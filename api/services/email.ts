/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<void>;
}

// SendGrid implementation
class SendGridProvider implements EmailProvider {
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: options.to }]
        }],
        from: { email: options.from || this.defaultFrom },
        subject: options.subject,
        content: [
          {
            type: 'text/plain',
            value: options.text
          },
          ...(options.html ? [{
            type: 'text/html',
            value: options.html
          }] : [])
        ],
        ...(options.attachments && {
          attachments: options.attachments.map(att => ({
            filename: att.filename,
            content: Buffer.isBuffer(att.content) 
              ? att.content.toString('base64')
              : Buffer.from(att.content).toString('base64'),
            type: att.contentType
          }))
        })
      })
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      let details: any = text;
      try {
        details = JSON.parse(text);
      } catch {}
      throw new Error(`SendGrid error (${status}): ${typeof details === 'string' ? details : JSON.stringify(details)}`);
    }
  }
}

// AWS SES implementation
class SESProvider implements EmailProvider {
  private accessKeyId: string;
  private secretAccessKey: string;
  private region: string;
  private defaultFrom: string;

  constructor(accessKeyId: string, secretAccessKey: string, region: string, defaultFrom: string) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
    this.defaultFrom = defaultFrom;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    // AWS SES implementation would go here
    // Using AWS SDK v3 for TypeScript
    throw new Error('SES provider not yet implemented');
  }
}

// Resend implementation
class ResendProvider implements EmailProvider {
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        ...(options.html && { html: options.html }),
        ...(options.attachments && {
          attachments: options.attachments.map(att => ({
            filename: att.filename,
            content: Buffer.isBuffer(att.content)
              ? att.content.toString('base64')
              : Buffer.from(att.content).toString('base64')
          }))
        })
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}

// Email templates
import { EmailTemplate, emailTemplates } from '../templates/emails';
import type { EmailTemplateRenderer } from '../templates/emails';

export { EmailTemplate };

interface TemplateData {
  [key: string]: any;
}

// Email service configuration
interface EmailServiceConfig {
  provider: 'sendgrid' | 'ses' | 'resend';
  apiKey?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  defaultFrom: string;
}

// Main email service
export class EmailService {
  private static validateConfig(config: EmailServiceConfig) {
    console.log('Email config:', { 
      provider: config.provider,
      hasApiKey: !!config.apiKey,
      from: config.defaultFrom
    });

    switch (config.provider) {
      case 'sendgrid':
        if (!config.apiKey) throw new Error('SendGrid API key required');
        break;
      
      case 'ses':
        if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
          throw new Error('AWS credentials required');
        }
        break;
      
      case 'resend':
        if (!config.apiKey) throw new Error('Resend API key required');
        break;
      
      default:
        throw new Error('Invalid email provider');
    }
  }
  private provider: EmailProvider;
  private templateRenderer: EmailTemplateRenderer;

constructor(config: EmailServiceConfig) {
    EmailService.validateConfig(config);
    console.log('Creating email service with provider:', config.provider);
    this.templateRenderer = emailTemplates;

    switch (config.provider) {
      case 'sendgrid':
        if (!config.apiKey) throw new Error('SendGrid API key required');
        this.provider = new SendGridProvider(config.apiKey, config.defaultFrom);
        break;
      
      case 'ses':
        if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
          throw new Error('AWS credentials required');
        }
        this.provider = new SESProvider(
          config.accessKeyId,
          config.secretAccessKey,
          config.region,
          config.defaultFrom
        );
        break;
      
      case 'resend':
        if (!config.apiKey) throw new Error('Resend API key required');
        this.provider = new ResendProvider(config.apiKey, config.defaultFrom);
        break;
      
      default:
        throw new Error('Invalid email provider');
    }
  }

  async sendTemplateEmail(
    to: string,
    template: EmailTemplate,
    data: TemplateData,
    options: Partial<EmailOptions> = {}
  ): Promise<void> {
    const rendered = this.templateRenderer.render(template, data);
    
    await this.provider.sendEmail({
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      ...options
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    await this.provider.sendEmail(options);
  }
}

// Export singleton instance with default configuration
const emailConfig: EmailServiceConfig = {
  provider: 'sendgrid',
  apiKey: process.env.SENDGRID_API_KEY,
  defaultFrom: process.env.EMAIL_FROM || 'rinawarptechnologies25@gmail.com'
};

// For local development fallback
const devEmailConfig: EmailServiceConfig = {
  provider: (process.env.EMAIL_PROVIDER || 'sendgrid') as 'sendgrid' | 'ses' | 'resend',
  apiKey: process.env.EMAIL_API_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  defaultFrom: process.env.EMAIL_FROM || 'notifications@rinawarptech.com'
};

export const emailService = new EmailService(emailConfig);
