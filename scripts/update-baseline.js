const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function updateBaseline() {
  const environments = ['staging', 'production'];
  const baselinePath = path.join(__dirname, '../config/performance/baseline-metrics.json');
  
  // Load current baseline
  const currentBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  
  for (const env of environments) {
    console.log(`\nUpdating baseline for ${env} environment...`);
    
    try {
      // Run performance tests
      console.log('Running performance tests...');
      execSync(`TEST_ENV=${env} yarn test:performance`, { stdio: 'inherit' });
      
      // Load test results
      const results = JSON.parse(fs.readFileSync('performance-results.json', 'utf8'));
      
      // Calculate new baseline metrics
      const newBaseline = {
        api: {
          avgResponseTime: calculatePercentile(results.metrics.operations['API Request'] || [], 50),
          p95: calculatePercentile(results.metrics.operations['API Request'] || [], 95),
          errorRate: calculateErrorRate(results.metrics.operations['API Request'] || []),
          rps: calculateRPS(results.metrics.operations['API Request'] || []),
          latencyBreakdown: {
            ai_completion: calculateAverage(results.metrics.operations['Run AI Completion'] || []),
            file_search: calculateAverage(results.metrics.operations['Search Files'] || []),
            user_operations: calculateAverage(results.metrics.operations['Execute Commands'] || []),
            database_queries: calculateAverage(results.metrics.operations['Process Data'] || [])
          }
        },
        electron: {
          startupTime: calculateAverage(results.metrics.startup),
          memoryUsage: calculateAverage(results.metrics.resources.memory) / 1024 / 1024,
          cpuUsage: calculateAverage(results.metrics.resources.cpu),
          resourceMetrics: {
            initial_load: calculatePercentile(results.metrics.startup, 90),
            idle_state: calculatePercentile(results.metrics.resources.cpu, 10),
            active_completion: calculatePercentile(results.metrics.operations['Run AI Completion'] || [], 90),
            file_indexing: calculatePercentile(results.metrics.operations['Search Files'] || [], 90)
          }
        },
        web: currentBaseline[env].web // Preserve web metrics as they're measured separately
      };

      // Update baseline with some safety margins
      currentBaseline[env] = {
        api: {
          ...newBaseline.api,
          avgResponseTime: Math.ceil(newBaseline.api.avgResponseTime * 1.1), // 10% margin
          p95: Math.ceil(newBaseline.api.p95 * 1.15), // 15% margin
          errorRate: Math.max(0.1, newBaseline.api.errorRate * 1.5), // Minimum 0.1%
          rps: Math.floor(newBaseline.api.rps * 0.9) // 10% margin
        },
        electron: {
          ...newBaseline.electron,
          startupTime: Math.ceil(newBaseline.electron.startupTime * 1.2), // 20% margin
          memoryUsage: Math.ceil(newBaseline.electron.memoryUsage * 1.15), // 15% margin
          cpuUsage: Math.ceil(newBaseline.electron.cpuUsage * 1.2) // 20% margin
        },
        web: currentBaseline[env].web
      };

      console.log(`✓ Updated baseline metrics for ${env}`);
    } catch (error) {
      console.error(`Failed to update baseline for ${env}:`, error);
      process.exit(1);
    }
  }

  // Save updated baseline
  fs.writeFileSync(baselinePath, JSON.stringify(currentBaseline, null, 2));
  console.log('\n✓ Successfully updated baseline metrics');
}

// Utility functions
function calculatePercentile(array, p) {
  if (!array.length) return 0;
  array.sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * array.length) - 1;
  return array[index];
}

function calculateAverage(array) {
  if (!array.length) return 0;
  return array.reduce((a, b) => a + b, 0) / array.length;
}

function calculateErrorRate(array) {
  if (!array.length) return 0;
  const errors = array.filter(duration => duration > 1000).length;
  return (errors / array.length) * 100;
}

function calculateRPS(array) {
  if (!array.length) return 0;
  const totalTime = Math.max(...array) - Math.min(...array);
  return (array.length / totalTime) * 1000;
}

// Run the update
updateBaseline().catch(console.error);
