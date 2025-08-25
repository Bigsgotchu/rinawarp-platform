#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

class ReportAggregator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../reports');
    this.outputDir = path.join(this.reportsDir, 'aggregated');
    
    // Ensure output directory exists
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async aggregateReports() {
    console.log('Aggregating reports...');
    
    const report = {
      timestamp: new Date().toISOString(),
      systemHealth: await this.getSystemHealth(),
      security: await this.getSecurityMetrics(),
      performance: await this.getPerformanceMetrics(),
      testing: await this.getTestingMetrics(),
      documentation: await this.getDocumentationStatus()
    };

    // Generate summary
    report.summary = this.generateSummary(report);

    // Save report
    const reportFile = path.join(
      this.outputDir,
      `daily-report-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`Report generated: ${reportFile}`);

    // Send notifications if needed
    if (report.summary.issuesCount > 0) {
      await this.sendNotifications(report);
    }

    return report;
  }

  async getSystemHealth() {
    try {
      const metricsFile = path.join(this.reportsDir, 'metrics/latest.json');
      const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
      
      return {
        status: this.calculateHealthStatus(metrics),
        uptime: metrics.uptime,
        componentStatus: metrics.components,
        resourceUtilization: metrics.resources
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  async getSecurityMetrics() {
    try {
      const securityFile = path.join(this.reportsDir, 'security/latest.json');
      const security = JSON.parse(fs.readFileSync(securityFile, 'utf8'));
      
      return {
        vulnerabilities: security.vulnerabilities,
        authFailures: security.authFailures,
        rateLimitExceeded: security.rateLimitExceeded,
        securityIncidents: security.incidents
      };
    } catch (error) {
      console.error('Error getting security metrics:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  async getPerformanceMetrics() {
    try {
      const performanceFile = path.join(this.reportsDir, 'performance/latest.json');
      const performance = JSON.parse(fs.readFileSync(performanceFile, 'utf8'));
      
      return {
        responseTime: performance.responseTime,
        errorRate: performance.errorRate,
        throughput: performance.throughput,
        resourceUsage: performance.resourceUsage
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  async getTestingMetrics() {
    try {
      const testingFile = path.join(this.reportsDir, 'test/latest.json');
      const testing = JSON.parse(fs.readFileSync(testingFile, 'utf8'));
      
      return {
        coverage: testing.coverage,
        passRate: testing.passRate,
        failedTests: testing.failedTests,
        skippedTests: testing.skippedTests
      };
    } catch (error) {
      console.error('Error getting testing metrics:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  async getDocumentationStatus() {
    try {
      const docFile = path.join(this.reportsDir, 'docs/latest.json');
      const docs = JSON.parse(fs.readFileSync(docFile, 'utf8'));
      
      return {
        coverage: docs.coverage,
        outdatedDocs: docs.outdatedDocs,
        missingDocs: docs.missingDocs,
        recentUpdates: docs.recentUpdates
      };
    } catch (error) {
      console.error('Error getting documentation status:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  calculateHealthStatus(metrics) {
    // Calculate overall health based on various metrics
    const checks = [
      metrics.uptime > 99,
      metrics.errorRate < 1,
      metrics.responseTime < 500,
      metrics.resourceUsage < 80
    ];
    
    const passedChecks = checks.filter(check => check).length;
    const healthPercentage = (passedChecks / checks.length) * 100;
    
    if (healthPercentage >= 90) return 'healthy';
    if (healthPercentage >= 70) return 'warning';
    return 'critical';
  }

  generateSummary(report) {
    const issues = [];
    let status = 'healthy';

    // Check system health
    if (report.systemHealth.status !== 'healthy') {
      issues.push(`System health is ${report.systemHealth.status}`);
      status = report.systemHealth.status;
    }

    // Check security
    if (report.security.vulnerabilities?.length > 0) {
      issues.push(`Found ${report.security.vulnerabilities.length} security vulnerabilities`);
      status = 'critical';
    }

    // Check performance
    if (report.performance.errorRate > 1) {
      issues.push(`High error rate: ${report.performance.errorRate}%`);
      status = status === 'healthy' ? 'warning' : status;
    }

    // Check testing
    if (report.testing.coverage < 80) {
      issues.push(`Low test coverage: ${report.testing.coverage}%`);
      status = status === 'healthy' ? 'warning' : status;
    }

    // Check documentation
    if (report.documentation.missingDocs?.length > 0) {
      issues.push(`Missing ${report.documentation.missingDocs.length} documentation items`);
      status = status === 'healthy' ? 'warning' : status;
    }

    return {
      status,
      issuesCount: issues.length,
      issues
    };
  }

  async sendNotifications(report) {
    // Configure email transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });

    // Prepare email content
    const emailContent = this.generateEmailContent(report);

    // Send email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.ALERT_EMAIL,
        subject: `Platform Status Report - ${report.summary.status.toUpperCase()}`,
        html: emailContent
      });
      console.log('Notification email sent');
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  generateEmailContent(report) {
    return `
      <h1>Platform Status Report</h1>
      <h2>Summary</h2>
      <p>Status: ${report.summary.status}</p>
      <p>Issues Found: ${report.summary.issuesCount}</p>
      
      ${report.summary.issues.length > 0 ? `
        <h3>Issues:</h3>
        <ul>
          ${report.summary.issues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
      ` : ''}
      
      <h2>System Health</h2>
      <p>Status: ${report.systemHealth.status}</p>
      <p>Uptime: ${report.systemHealth.uptime}%</p>
      
      <h2>Security</h2>
      <p>Vulnerabilities: ${report.security.vulnerabilities?.length || 0}</p>
      <p>Auth Failures: ${report.security.authFailures || 0}</p>
      
      <h2>Performance</h2>
      <p>Response Time: ${report.performance.responseTime}ms</p>
      <p>Error Rate: ${report.performance.errorRate}%</p>
      
      <h2>Testing</h2>
      <p>Coverage: ${report.testing.coverage}%</p>
      <p>Pass Rate: ${report.testing.passRate}%</p>
      
      <h2>Documentation</h2>
      <p>Missing Docs: ${report.documentation.missingDocs?.length || 0}</p>
      <p>Recent Updates: ${report.documentation.recentUpdates?.length || 0}</p>
    `;
  }
}

// Execute if run directly
if (require.main === module) {
  const aggregator = new ReportAggregator();
  aggregator.aggregateReports()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = ReportAggregator;
