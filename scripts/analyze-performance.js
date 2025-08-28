const fs = require('fs');
const path = require('path');

// Read command line arguments
const args = process.argv.slice(2);
const k6ResultsPath = args.find(a => a.startsWith('--k6-results=')).split('=')[1];
const electronResultsPath = args.find(a => a.startsWith('--electron-results=')).split('=')[1];
const baselinePath = args.find(a => a.startsWith('--baseline=')).split('=')[1];

// Load test results
const k6Results = JSON.parse(fs.readFileSync(k6ResultsPath, 'utf8'));
const electronResults = JSON.parse(fs.readFileSync(electronResultsPath, 'utf8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

// Analysis thresholds
const thresholds = {
  api: {
    avgResponseTime: 200,  // ms
    p95: 500,             // ms
    errorRate: 1,         // %
    rpsMin: 100,          // requests per second
  },
  electron: {
    startupTime: 2000,    // ms
    memoryUsage: 200,     // MB
    cpuUsage: 10,         // %
  },
  regressions: {
    responseTime: 20,     // % increase
    errorRate: 50,        // % increase
    resourceUsage: 30,    // % increase
  },
};

// Analyze API performance
const apiMetrics = {
  avgResponseTime: k6Results.metrics.http_req_duration.avg,
  p95: k6Results.metrics.http_req_duration.p95,
  errorRate: k6Results.metrics.error_rate.rate * 100,
  rps: k6Results.metrics.iterations.rate,
};

// Analyze Electron performance
const electronMetrics = {
  startupTime: electronResults.startupTime,
  memoryUsage: electronResults.memoryUsage,
  cpuUsage: electronResults.cpuUsage,
};

// Compare with baseline
const regressions = [];

// API regressions
if (apiMetrics.avgResponseTime > baseline.api.avgResponseTime * (1 + thresholds.regressions.responseTime / 100)) {
  regressions.push(`API response time increased by ${((apiMetrics.avgResponseTime - baseline.api.avgResponseTime) / baseline.api.avgResponseTime * 100).toFixed(1)}%`);
}

if (apiMetrics.errorRate > baseline.api.errorRate * (1 + thresholds.regressions.errorRate / 100)) {
  regressions.push(`API error rate increased by ${((apiMetrics.errorRate - baseline.api.errorRate) / baseline.api.errorRate * 100).toFixed(1)}%`);
}

// Electron regressions
if (electronMetrics.startupTime > baseline.electron.startupTime * (1 + thresholds.regressions.responseTime / 100)) {
  regressions.push(`Electron startup time increased by ${((electronMetrics.startupTime - baseline.electron.startupTime) / baseline.electron.startupTime * 100).toFixed(1)}%`);
}

if (electronMetrics.memoryUsage > baseline.electron.memoryUsage * (1 + thresholds.regressions.resourceUsage / 100)) {
  regressions.push(`Electron memory usage increased by ${((electronMetrics.memoryUsage - baseline.electron.memoryUsage) / baseline.electron.memoryUsage * 100).toFixed(1)}%`);
}

if (electronMetrics.cpuUsage > baseline.electron.cpuUsage * (1 + thresholds.regressions.resourceUsage / 100)) {
  regressions.push(`Electron CPU usage increased by ${((electronMetrics.cpuUsage - baseline.electron.cpuUsage) / baseline.electron.cpuUsage * 100).toFixed(1)}%`);
}

// Generate analysis report
const analysis = {
  timestamp: new Date().toISOString(),
  api: apiMetrics,
  electron: electronMetrics,
  regressions,
  thresholdViolations: [],
};

// Check threshold violations
if (apiMetrics.avgResponseTime > thresholds.api.avgResponseTime) {
  analysis.thresholdViolations.push(`API average response time (${apiMetrics.avgResponseTime}ms) exceeds threshold (${thresholds.api.avgResponseTime}ms)`);
}

if (apiMetrics.p95 > thresholds.api.p95) {
  analysis.thresholdViolations.push(`API P95 response time (${apiMetrics.p95}ms) exceeds threshold (${thresholds.api.p95}ms)`);
}

if (apiMetrics.errorRate > thresholds.api.errorRate) {
  analysis.thresholdViolations.push(`API error rate (${apiMetrics.errorRate}%) exceeds threshold (${thresholds.api.errorRate}%)`);
}

if (electronMetrics.startupTime > thresholds.electron.startupTime) {
  analysis.thresholdViolations.push(`Electron startup time (${electronMetrics.startupTime}ms) exceeds threshold (${thresholds.electron.startupTime}ms)`);
}

// Save analysis results
fs.writeFileSync('performance-analysis.json', JSON.stringify(analysis, null, 2));

// Exit with error if there are regressions or violations
if (analysis.regressions.length > 0 || analysis.thresholdViolations.length > 0) {
  console.error('Performance test failed:');
  if (analysis.regressions.length > 0) {
    console.error('\nRegressions:');
    analysis.regressions.forEach(r => console.error(`- ${r}`));
  }
  if (analysis.thresholdViolations.length > 0) {
    console.error('\nThreshold Violations:');
    analysis.thresholdViolations.forEach(v => console.error(`- ${v}`));
  }
  process.exit(1);
} else {
  console.log('Performance test passed successfully');
}
