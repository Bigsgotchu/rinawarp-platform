import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import handlebars from 'handlebars';

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter;
  private templates: Map<string, handlebars.TemplateDelegate>;

  private constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.templates = new Map();
    this.loadTemplates();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/email');
    const templateFiles = fs.readdirSync(templatesDir);

    for (const file of templateFiles) {
      const templateName = path.parse(file).name;
      const templateContent = fs.readFileSync(
        path.join(templatesDir, file),
        'utf-8'
      );
      this.templates.set(templateName, handlebars.compile(templateContent));
    }
  }

  private async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: any
  ): Promise<void> {
    try {
      const templateFn = this.templates.get(template);
      if (!templateFn) {
        throw new Error(`Template ${template} not found`);
      }

      const html = templateFn(context);

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
      });

      logger.info('Email sent successfully', {
        to,
        subject,
        template,
      });
    } catch (error) {
      logger.error('Failed to send email', {
        error,
        to,
        subject,
        template,
      });
      throw error;
    }
  }

  public async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    name: string
  ): Promise<void> {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;

    await this.sendEmail(to, 'Reset Your Password', 'password-reset', {
      name,
      resetUrl,
      expiresIn: '1 hour',
    });
  }

  public async send2FASetupEmail(
    to: string,
    name: string,
    qrCode: string,
    backupCodes: string[]
  ): Promise<void> {
    await this.sendEmail(to, '2FA Setup Instructions', '2fa-setup', {
      name,
      qrCode,
      backupCodes,
    });
  }

  public async sendLoginAlertEmail(
    to: string,
    name: string,
    deviceInfo: any,
    location: string
  ): Promise<void> {
    await this.sendEmail(to, 'New Login Detected', 'login-alert', {
      name,
      deviceInfo,
      location,
      timestamp: new Date().toISOString(),
    });
  }

  public async sendPasswordChangedEmail(
    to: string,
    name: string
  ): Promise<void> {
    await this.sendEmail(to, 'Password Changed', 'password-changed', {
      name,
      timestamp: new Date().toISOString(),
    });
  }

  public async send2FADisabledEmail(to: string, name: string): Promise<void> {
    await this.sendEmail(to, '2FA Disabled', '2fa-disabled', {
      name,
      timestamp: new Date().toISOString(),
    });
  }
}
