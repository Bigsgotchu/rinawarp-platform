/**
 * Copyright (c) 2024-2025 Rinawarp Technologies, LLC. All rights reserved.
 * Licensed under the MIT License.
 */

export enum EmailTemplate {
  // Usage & Limits
  USAGE_WARNING = 'usage_warning',
  LIMIT_EXCEEDED = 'limit_exceeded',
  UPGRADE_RECOMMENDED = 'upgrade_recommended',
  
  // Account & Subscription
  WELCOME = 'welcome',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  PAYMENT_FAILED = 'payment_failed',
  
  // Engagement & Features
  NEW_FEATURES = 'new_features',
  UNUSED_FEATURES = 'unused_features',
  GETTING_STARTED = 'getting_started',
  WORKFLOW_TIPS = 'workflow_tips',
  
  // Professional & Enterprise
  TEAM_INVITE = 'team_invite',
  TEAM_ACTIVITY = 'team_activity',
  USAGE_REPORT = 'usage_report',
  API_KEYS_EXPIRING = 'api_keys_expiring'
}

export interface TemplateData {
  [key: string]: any;
}

export class EmailTemplateRenderer {
  private templates: Record<EmailTemplate, (data: TemplateData) => { subject: string; text: string; html: string }> = {
    // Usage & Limits Templates
    [EmailTemplate.USAGE_WARNING]: this.renderUsageWarning,
    [EmailTemplate.LIMIT_EXCEEDED]: this.renderLimitExceeded,
    [EmailTemplate.UPGRADE_RECOMMENDED]: this.renderUpgradeRecommended,

    // Account & Subscription Templates
    [EmailTemplate.WELCOME]: this.renderWelcome,
    [EmailTemplate.SUBSCRIPTION_UPDATED]: this.renderSubscriptionUpdated,
    [EmailTemplate.PAYMENT_FAILED]: this.renderPaymentFailed,

    // Engagement & Features Templates
    [EmailTemplate.NEW_FEATURES]: this.renderNewFeatures,
    [EmailTemplate.UNUSED_FEATURES]: this.renderUnusedFeatures,
    [EmailTemplate.GETTING_STARTED]: this.renderGettingStarted,
    [EmailTemplate.WORKFLOW_TIPS]: this.renderWorkflowTips,

    // Professional & Enterprise Templates
    [EmailTemplate.TEAM_INVITE]: this.renderTeamInvite,
    [EmailTemplate.TEAM_ACTIVITY]: this.renderTeamActivity,
    [EmailTemplate.USAGE_REPORT]: this.renderUsageReport,
    [EmailTemplate.API_KEYS_EXPIRING]: this.renderApiKeysExpiring,
  };

  render(template: EmailTemplate, data: TemplateData) {
    const renderer = this.templates[template];
    if (!renderer) {
      throw new Error(`Template ${template} not found`);
    }
    return renderer.call(this, data);
  }

  // Common Components
  private renderButton(text: string, url: string, color = '#007bff'): string {
    return `
      <a href="${url}" 
         style="display: inline-block; padding: 12px 24px; 
                background: ${color}; color: white; 
                text-decoration: none; border-radius: 5px; 
                margin: 10px 0;">
        ${text}
      </a>
    `;
  }

  private renderMetricBar(value: number, max: number, label: string): string {
    const percent = Math.min((value / max) * 100, 100);
    const color = percent > 90 ? '#dc3545' : percent > 75 ? '#ffc107' : '#007bff';
    
    return `
      <div style="margin: 15px 0;">
        <div style="font-weight: bold; margin-bottom: 5px;">${label}</div>
        <div style="background: #e9ecef; height: 20px; border-radius: 10px;">
          <div style="background: ${color}; width: ${percent}%; height: 100%; 
                      border-radius: 10px; transition: width 0.3s ease;">
          </div>
        </div>
        <div style="font-size: 0.9em; color: #6c757d; margin-top: 5px;">
          ${value} of ${max} (${percent.toFixed(1)}%)
        </div>
      </div>
    `;
  }

  private renderFeatureHighlight(icon: string, title: string, description: string): string {
    return `
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <div style="font-size: 24px; margin-bottom: 10px;">${icon}</div>
        <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
        <p style="margin: 0; color: #666;">${description}</p>
      </div>
    `;
  }

  // Usage & Limits Templates
  private renderUsageWarning(data: TemplateData) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Usage Alert</h2>
            <p>Your API usage has reached ${data.usagePercent}% of your monthly limit.</p>
          </div>
          
          ${this.renderMetricBar(data.used, data.limit, 'API Requests')}
          
          <p><strong>Current Usage Details:</strong></p>
          <ul>
            <li>Used: ${data.used} requests</li>
            <li>Limit: ${data.limit} requests</li>
            <li>Reset Date: ${data.resetDate}</li>
          </ul>
          
          <p><strong>Recommended Actions:</strong></p>
          ${this.renderButton('View Usage Details', data.usageUrl)}
          ${this.renderButton('Upgrade Plan', data.upgradeUrl)}
          
          <p style="margin-top: 30px; color: #666;">
            Need help? Reply to this email or visit our support center.
          </p>
        </div>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #999; font-size: 13px; text-align: center;">
      You're receiving this email because you're a RinaWarp Technologies user. 
      If you don't want to receive ${type} emails, you can 
      <a href="${unsubscribeUrl}" style="color: #999;">unsubscribe</a>.
      <br><br>
      RinaWarp Technologies, LLC<br>
      {{address}}
    </p>
  </body>
</html>
    `.trim();

    const text = `
      Usage Alert
      
      Your API usage has reached ${data.usagePercent}% of your monthly limit.
      
      Current Usage Details:
      - Used: ${data.used} requests
      - Limit: ${data.limit} requests
      - Reset Date: ${data.resetDate}
      
      Recommended Actions:
      1. View your usage details: ${data.usageUrl}
      2. Consider upgrading your plan: ${data.upgradeUrl}
      
      Need help? Reply to this email or visit our support center.
    `;

    return {
      subject: `Usage Alert: ${data.usagePercent}% of Monthly Limit`,
      html: html.trim(),
      text: text.trim()
    };
  }

  // New Features Template
  private renderNewFeatures(data: TemplateData) {
    const featuresList = data.features.map((feature: any) => 
      this.renderFeatureHighlight(
        feature.icon,
        feature.title,
        feature.description
      )
    ).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Features Available! 🎉</h1>
            <p>We've added some exciting new capabilities to enhance your experience.</p>
          </div>

          ${featuresList}
          
          <div style="text-align: center; margin-top: 30px;">
            ${this.renderButton('Try New Features', data.featuresUrl)}
          </div>

          <p style="margin-top: 30px; text-align: center; color: #666;">
            Questions about the new features? Check out our 
            <a href="${data.docsUrl}">documentation</a> or 
            <a href="${data.supportUrl}">contact support</a>.
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
      New Features Available! 🎉
      
      We've added some exciting new capabilities to enhance your experience.
      
      New Features:
      ${data.features.map((f: any) => `\n- ${f.title}: ${f.description}`).join('')}
      
      Try the new features: ${data.featuresUrl}
      
      Questions? 
      - Documentation: ${data.docsUrl}
      - Support: ${data.supportUrl}
    `;

    return {
      subject: 'New Features Available! 🎉',
      html: html.trim(),
      text: text.trim()
    };
  }

  // Workflow Tips Template
  private renderWorkflowTips(data: TemplateData) {
    const tipsList = data.tips.map((tip: any) => `
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">💡 ${tip.title}</h3>
        <p style="margin: 0 0 10px 0; color: #666;">${tip.description}</p>
        <pre style="background: #eee; padding: 10px; border-radius: 5px; overflow-x: auto;">
          <code>${tip.example}</code>
        </pre>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Power User Tips 💪</h1>
            <p>Level up your terminal game with these productivity boosters!</p>
          </div>

          ${tipsList}
          
          <div style="text-align: center; margin-top: 30px;">
            ${this.renderButton('View All Tips', data.tipsUrl)}
            ${this.renderButton('Share Your Tips', data.shareUrl, '#28a745')}
          </div>

          <p style="margin-top: 30px; text-align: center; color: #666;">
            Want more tips? Follow us on 
            <a href="${data.twitterUrl}">Twitter</a> or join our 
            <a href="${data.discordUrl}">Discord community</a>.
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Power User Tips 💪
      
      Level up your terminal game with these productivity boosters!
      
      Tips:
      ${data.tips.map((tip: any) => `
      💡 ${tip.title}
      ${tip.description}
      Example: ${tip.example}
      `).join('\n')}
      
      View all tips: ${data.tipsUrl}
      Share your tips: ${data.shareUrl}
      
      Want more tips?
      - Twitter: ${data.twitterUrl}
      - Discord: ${data.discordUrl}
    `;

    return {
      subject: 'Power User Tips for RinaWarp Terminal 💪',
      html: html.trim(),
      text: text.trim()
    };
  }

  // Enterprise Usage Report Template
  private renderUsageReport(data: TemplateData) {
    const teamMetrics = Object.entries(data.teamMetrics).map(([metric, value]) => 
      this.renderMetricBar(value as number, data.limits[metric], metric)
    ).join('');

    const topUsers = data.topUsers.map((user: any) => `
      <tr style="border-bottom: 1px solid #dee2e6;">
        <td style="padding: 10px;">${user.name}</td>
        <td style="padding: 10px;">${user.requests}</td>
        <td style="padding: 10px;">${user.tokensUsed}</td>
        <td style="padding: 10px;">${user.avgResponseTime}ms</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 10px; background: #f8f9fa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Monthly Usage Report</h1>
            <p>Here's your team's usage summary for ${data.period}.</p>
          </div>

          <h2>Team Metrics</h2>
          ${teamMetrics}

          <h2>Top Users</h2>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Requests</th>
                <th>Tokens</th>
                <th>Avg Response</th>
              </tr>
            </thead>
            <tbody>
              ${topUsers}
            </tbody>
          </table>
          
          <div style="text-align: center; margin-top: 30px;">
            ${this.renderButton('View Full Report', data.reportUrl)}
            ${this.renderButton('Manage Team', data.teamUrl, '#28a745')}
          </div>

          <p style="margin-top: 30px; color: #666;">
            Need to adjust your team's limits or have questions? 
            Contact your account manager or <a href="${data.supportUrl}">support team</a>.
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Monthly Usage Report
      
      Here's your team's usage summary for ${data.period}.
      
      Team Metrics:
      ${Object.entries(data.teamMetrics).map(([metric, value]) => 
        `${metric}: ${value} / ${data.limits[metric]}`
      ).join('\n')}
      
      Top Users:
      ${data.topUsers.map((user: any) => 
        `- ${user.name}: ${user.requests} requests, ${user.tokensUsed} tokens, ${user.avgResponseTime}ms avg`
      ).join('\n')}
      
      View full report: ${data.reportUrl}
      Manage team: ${data.teamUrl}
      
      Need help? Contact support: ${data.supportUrl}
    `;

    return {
      subject: `Monthly Usage Report - ${data.period}`,
      html: html.trim(),
      text: text.trim()
    };
  }

  // Other templates would be implemented similarly...
  private renderLimitExceeded(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderUpgradeRecommended(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderWelcome(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderSubscriptionUpdated(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderPaymentFailed(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderUnusedFeatures(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderGettingStarted(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderTeamInvite(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderTeamActivity(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
  
  private renderApiKeysExpiring(data: TemplateData) {
    return { subject: '', html: '', text: '' };
  }
}

// Export singleton instance
export const emailTemplates = new EmailTemplateRenderer();
