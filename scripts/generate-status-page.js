#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

class StatusPageGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../reports');
    this.outputDir = path.join(__dirname, '../public/status');
    
    // Ensure output directory exists
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async generateStatusPage() {
    console.log('Generating status page...');
    
    const status = {
      timestamp: new Date().toISOString(),
      components: await this.getComponentStatus(),
      incidents: await this.getActiveIncidents(),
      metrics: await this.getMetrics(),
      maintenanceWindows: await this.getMaintenanceWindows()
    };

    // Generate HTML
    const html = this.generateHTML(status);

    // Save status page
    const outputFile = path.join(this.outputDir, 'index.html');
    fs.writeFileSync(outputFile, html);
    console.log(`Status page generated: ${outputFile}`);

    // Generate JSON status for API
    const jsonFile = path.join(this.outputDir, 'status.json');
    fs.writeFileSync(jsonFile, JSON.stringify(status, null, 2));
    console.log(`Status JSON generated: ${jsonFile}`);

    return status;
  }

  async getComponentStatus() {
    try {
      const components = [
        {
          name: 'API Service',
          type: 'service',
          metrics: ['uptime', 'latency', 'errors']
        },
        {
          name: 'Database',
          type: 'database',
          metrics: ['connections', 'latency', 'replication']
        },
        {
          name: 'Cache',
          type: 'cache',
          metrics: ['memory', 'hits', 'misses']
        },
        {
          name: 'Authentication',
          type: 'security',
          metrics: ['success_rate', 'token_validity']
        },
        {
          name: 'Storage',
          type: 'storage',
          metrics: ['usage', 'iops', 'latency']
        }
      ];

      // Get latest metrics for each component
      for (const component of components) {
        const metricsFile = path.join(
          this.reportsDir,
          `metrics/${component.name.toLowerCase()}.json`
        );
        
        if (fs.existsSync(metricsFile)) {
          const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
          component.status = this.calculateComponentStatus(metrics);
          component.metrics = metrics;
        } else {
          component.status = 'unknown';
        }
      }

      return components;
    } catch (error) {
      console.error('Error getting component status:', error);
      return [];
    }
  }

  async getActiveIncidents() {
    try {
      const incidentsFile = path.join(this.reportsDir, 'incidents/active.json');
      if (fs.existsSync(incidentsFile)) {
        return JSON.parse(fs.readFileSync(incidentsFile, 'utf8'));
      }
      return [];
    } catch (error) {
      console.error('Error getting active incidents:', error);
      return [];
    }
  }

  async getMetrics() {
    try {
      const metrics = {
        uptime: this.calculateUptime(),
        responseTime: this.getAverageResponseTime(),
        errorRate: this.getErrorRate(),
        throughput: this.getThroughput()
      };

      // Add historical data
      metrics.history = await this.getMetricsHistory();

      return metrics;
    } catch (error) {
      console.error('Error getting metrics:', error);
      return {};
    }
  }

  async getMaintenanceWindows() {
    try {
      const maintenanceFile = path.join(this.reportsDir, 'maintenance/schedule.json');
      if (fs.existsSync(maintenanceFile)) {
        return JSON.parse(fs.readFileSync(maintenanceFile, 'utf8'));
      }
      return [];
    } catch (error) {
      console.error('Error getting maintenance windows:', error);
      return [];
    }
  }

  calculateComponentStatus(metrics) {
    if (!metrics) return 'unknown';

    // Define thresholds for different metrics
    const thresholds = {
      uptime: { warning: 95, critical: 90 },
      latency: { warning: 500, critical: 1000 },
      errorRate: { warning: 1, critical: 5 },
      memory: { warning: 80, critical: 90 },
      cpu: { warning: 70, critical: 85 }
    };

    // Check each metric against thresholds
    let status = 'operational';
    
    Object.entries(metrics).forEach(([metric, value]) => {
      if (thresholds[metric]) {
        if (value > thresholds[metric].critical) {
          status = 'critical';
        } else if (value > thresholds[metric].warning && status !== 'critical') {
          status = 'degraded';
        }
      }
    });

    return status;
  }

  calculateUptime() {
    try {
      const uptimeFile = path.join(this.reportsDir, 'metrics/uptime.json');
      const uptime = JSON.parse(fs.readFileSync(uptimeFile, 'utf8'));
      return uptime.percentage;
    } catch (error) {
      console.error('Error calculating uptime:', error);
      return null;
    }
  }

  getAverageResponseTime() {
    try {
      const responseTimeFile = path.join(this.reportsDir, 'metrics/response_time.json');
      const data = JSON.parse(fs.readFileSync(responseTimeFile, 'utf8'));
      return data.average;
    } catch (error) {
      console.error('Error getting average response time:', error);
      return null;
    }
  }

  getErrorRate() {
    try {
      const errorFile = path.join(this.reportsDir, 'metrics/errors.json');
      const data = JSON.parse(fs.readFileSync(errorFile, 'utf8'));
      return data.rate;
    } catch (error) {
      console.error('Error getting error rate:', error);
      return null;
    }
  }

  getThroughput() {
    try {
      const throughputFile = path.join(this.reportsDir, 'metrics/throughput.json');
      const data = JSON.parse(fs.readFileSync(throughputFile, 'utf8'));
      return data.requests_per_second;
    } catch (error) {
      console.error('Error getting throughput:', error);
      return null;
    }
  }

  async getMetricsHistory() {
    try {
      const historyFile = path.join(this.reportsDir, 'metrics/history.json');
      if (fs.existsSync(historyFile)) {
        return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      }
      return [];
    } catch (error) {
      console.error('Error getting metrics history:', error);
      return [];
    }
  }

  generateHTML(status) {
    const template = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Rinawarp Platform Status</title>
        <style>
          :root {
            --color-bg: #ffffff;
            --color-text: #333333;
            --color-primary: #2196f3;
            --color-success: #4caf50;
            --color-warning: #ff9800;
            --color-error: #f44336;
            --color-gray: #9e9e9e;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background: var(--color-bg);
            color: var(--color-text);
          }

          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }

          .header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .status-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
          }

          .status-card {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .component-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
          }

          .component {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
          }

          .status-operational { background: var(--color-success); }
          .status-degraded { background: var(--color-warning); }
          .status-critical { background: var(--color-error); }
          .status-unknown { background: var(--color-gray); }

          .metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
          }

          .incidents {
            margin-bottom: 2rem;
          }

          .incident {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .maintenance {
            margin-bottom: 2rem;
          }

          .maintenance-window {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          footer {
            text-align: center;
            padding: 2rem;
            color: var(--color-gray);
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --color-bg: #121212;
              --color-text: #ffffff;
            }

            .status-card,
            .component,
            .incident,
            .maintenance-window {
              background: #1e1e1e;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <h1>Rinawarp Platform Status</h1>
            <p>Last updated: {{formatDate timestamp}}</p>
          </header>

          <div class="status-overview">
            <div class="status-card">
              <h2>System Status</h2>
              <div class="status-indicator status-{{overallStatus}}"></div>
              <span>{{overallStatus}}</span>
            </div>
            <div class="status-card">
              <h2>Uptime</h2>
              <div class="metric">
                <span>30-day average</span>
                <span>{{metrics.uptime}}%</span>
              </div>
            </div>
            <div class="status-card">
              <h2>Response Time</h2>
              <div class="metric">
                <span>Average</span>
                <span>{{metrics.responseTime}}ms</span>
              </div>
            </div>
          </div>

          <section class="components">
            <h2>Component Status</h2>
            <div class="component-grid">
              {{#each components}}
                <div class="component">
                  <h3>
                    <div class="status-indicator status-{{status}}"></div>
                    {{name}}
                  </h3>
                  {{#each metrics}}
                    <div class="metric">
                      <span>{{@key}}</span>
                      <span>{{this}}</span>
                    </div>
                  {{/each}}
                </div>
              {{/each}}
            </div>
          </section>

          {{#if incidents.length}}
            <section class="incidents">
              <h2>Active Incidents</h2>
              {{#each incidents}}
                <div class="incident">
                  <h3>{{title}}</h3>
                  <p>{{description}}</p>
                  <p><strong>Status:</strong> {{status}}</p>
                  <p><strong>Started:</strong> {{formatDate started_at}}</p>
                </div>
              {{/each}}
            </section>
          {{/if}}

          {{#if maintenanceWindows.length}}
            <section class="maintenance">
              <h2>Scheduled Maintenance</h2>
              {{#each maintenanceWindows}}
                <div class="maintenance-window">
                  <h3>{{title}}</h3>
                  <p>{{description}}</p>
                  <p><strong>Scheduled:</strong> {{formatDate scheduled_at}}</p>
                  <p><strong>Duration:</strong> {{duration}}</p>
                </div>
              {{/each}}
            </section>
          {{/if}}

          <footer>
            <p>For support, contact <a href="mailto:support@rinawarp.com">support@rinawarp.com</a></p>
          </footer>
        </div>

        <script>
          // Auto-refresh every 60 seconds
          setTimeout(() => location.reload(), 60000);
        </script>
      </body>
      </html>
    `;

    // Register helper for date formatting
    handlebars.registerHelper('formatDate', function(date) {
      return new Date(date).toLocaleString();
    });

    // Calculate overall status
    status.overallStatus = this.calculateOverallStatus(status);

    // Compile and render template
    const compiledTemplate = handlebars.compile(template);
    return compiledTemplate(status);
  }

  calculateOverallStatus(status) {
    if (status.incidents.length > 0) return 'critical';
    
    const componentStatuses = status.components.map(c => c.status);
    if (componentStatuses.includes('critical')) return 'critical';
    if (componentStatuses.includes('degraded')) return 'degraded';
    if (componentStatuses.every(s => s === 'operational')) return 'operational';
    return 'unknown';
  }
}

// Execute if run directly
if (require.main === module) {
  const generator = new StatusPageGenerator();
  generator.generateStatusPage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = StatusPageGenerator;
