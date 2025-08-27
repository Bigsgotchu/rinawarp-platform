import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../src/config/env';

interface IncidentUpdate {
  timestamp: string;
  status: string;
  message: string;
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  updates: IncidentUpdate[];
  created_at: string;
  resolved_at?: string;
}

interface ComponentStatus {
  name: string;
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage';
  updated_at: string;
}

interface StatusPageData {
  page: {
    id: string;
    name: string;
    url: string;
    updated_at: string;
  };
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical';
    description: string;
  };
  components: ComponentStatus[];
  incidents: Incident[];
  scheduled_maintenances: any[];
}

async function fetchHealthStatus(): Promise<ComponentStatus[]> {
  try {
    const response = await axios.get(`${env.API_URL}/health/detailed`);
    const health = response.data;

    return Object.entries(health.checks).map(([name, check]: [string, any]) => ({
      name,
      status: check.status === 'healthy' ? 'operational' : 'partial_outage',
      updated_at: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to fetch health status:', error);
    return [];
  }
}

async function generateStatusPage() {
  const components = await fetchHealthStatus();
  
  // Determine overall status
  const hasOutage = components.some(c => c.status !== 'operational');
  const hasMajorOutage = components.some(c => c.status === 'major_outage');
  
  const statusData: StatusPageData = {
    page: {
      id: 'rinawarp-status',
      name: 'Rinawarp System Status',
      url: 'https://status.rinawarp.com',
      updated_at: new Date().toISOString(),
    },
    status: {
      indicator: hasMajorOutage ? 'critical' : hasOutage ? 'minor' : 'none',
      description: hasMajorOutage 
        ? 'Major System Outage'
        : hasOutage 
        ? 'Partial System Outage'
        : 'All Systems Operational',
    },
    components,
    incidents: [], // Would be populated from an incident management system
    scheduled_maintenances: [], // Would be populated from a maintenance schedule
  };

  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${statusData.page.name}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .status-indicator {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
            text-align: center;
        }
        .status-none { background: #2ecc71; color: white; }
        .status-minor { background: #f1c40f; color: white; }
        .status-major { background: #e67e22; color: white; }
        .status-critical { background: #e74c3c; color: white; }
        .component {
            padding: 15px;
            border-bottom: 1px solid #eee;
        }
        .component:last-child {
            border-bottom: none;
        }
        .operational { color: #2ecc71; }
        .degraded_performance { color: #f1c40f; }
        .partial_outage { color: #e67e22; }
        .major_outage { color: #e74c3c; }
        .timestamp {
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${statusData.page.name}</h1>
            <p class="timestamp">Last updated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="status-indicator status-${statusData.status.indicator}">
            ${statusData.status.description}
        </div>

        <h2>Component Status</h2>
        ${components.map(component => `
            <div class="component">
                <h3>${component.name}</h3>
                <p class="${component.status}">${component.status.replace('_', ' ').toUpperCase()}</p>
                <p class="timestamp">Updated: ${new Date(component.updated_at).toLocaleString()}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>
  `;

  // Save the status page
  const outputDir = path.join(process.cwd(), 'static', 'status');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'index.html'), html);
  
  // Save the status data as JSON for API consumption
  await fs.writeFile(
    path.join(outputDir, 'status.json'),
    JSON.stringify(statusData, null, 2)
  );

  console.log('Status page generated successfully');
}

// Run the generator
generateStatusPage().catch(console.error);
