#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestMonitor {
  constructor() {
    this.reportDir = path.join(__dirname, '../reports/test');
    this.coverageDir = path.join(__dirname, '../coverage');
    this.historyFile = path.join(this.reportDir, 'test-history.json');
    
    // Ensure directories exist
    fs.mkdirSync(this.reportDir, { recursive: true });
    fs.mkdirSync(this.coverageDir, { recursive: true });
  }

  async runTests() {
    console.log('Running test suite...');
    
    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      duration: 0,
      results: {},
      coverage: {},
      trends: {}
    };

    try {
      // Run unit tests
      console.log('Running unit tests...');
      const unitTestOutput = execSync('npm run test:coverage', { encoding: 'utf8' });
      results.results.unit = this.parseTestOutput(unitTestOutput);

      // Run integration tests
      console.log('Running integration tests...');
      const integrationTestOutput = execSync('npm run test:integration', { encoding: 'utf8' });
      results.results.integration = this.parseTestOutput(integrationTestOutput);

      // Run E2E tests
      console.log('Running E2E tests...');
      const e2eTestOutput = execSync('npm run test:e2e', { encoding: 'utf8' });
      results.results.e2e = this.parseTestOutput(e2eTestOutput);

      // Get coverage data
      results.coverage = this.getCoverageData();

      // Calculate duration
      results.duration = Date.now() - startTime;

      // Update history and calculate trends
      this.updateHistory(results);
      results.trends = this.calculateTrends();

      // Generate report
      this.generateReport(results);

      console.log('Test monitoring completed successfully');
      return results;
    } catch (error) {
      console.error('Error running tests:', error);
      this.sendAlert('Test Failure', `Test suite failed: ${error.message}`);
      throw error;
    }
  }

  parseTestOutput(output) {
    // Parse Jest output
    const lines = output.split('\n');
    const result = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0
    };

    // Simple parsing logic - enhance based on actual output format
    lines.forEach(line => {
      if (line.includes('Tests:')) {
        const matches = line.match(/(\d+) passed, (\d+) failed, (\d+) skipped/);
        if (matches) {
          result.passed = parseInt(matches[1]);
          result.failed = parseInt(matches[2]);
          result.skipped = parseInt(matches[3]);
          result.total = result.passed + result.failed + result.skipped;
        }
      }
      if (line.includes('Time:')) {
        const timeMatch = line.match(/Time:\s+(\d+(\.\d+)?)/);
        if (timeMatch) {
          result.duration = parseFloat(timeMatch[1]);
        }
      }
    });

    return result;
  }

  getCoverageData() {
    try {
      const coverageFile = path.join(this.coverageDir, 'coverage-final.json');
      const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
      
      // Calculate overall coverage metrics
      let totalStatements = 0;
      let coveredStatements = 0;
      let totalBranches = 0;
      let coveredBranches = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;

      Object.values(coverage).forEach(file => {
        totalStatements += file.s.total;
        coveredStatements += file.s.covered;
        totalBranches += file.b.total;
        coveredBranches += file.b.covered;
        totalFunctions += file.f.total;
        coveredFunctions += file.f.covered;
      });

      return {
        statements: (coveredStatements / totalStatements) * 100,
        branches: (coveredBranches / totalBranches) * 100,
        functions: (coveredFunctions / totalFunctions) * 100
      };
    } catch (error) {
      console.error('Error reading coverage data:', error);
      return null;
    }
  }

  updateHistory(results) {
    try {
      let history = [];
      if (fs.existsSync(this.historyFile)) {
        history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }

      // Keep last 52 weeks of data (weekly runs)
      history.push(results);
      if (history.length > 52) {
        history = history.slice(-52);
      }

      fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Error updating history:', error);
    }
  }

  calculateTrends() {
    try {
      const history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      const trends = {
        coverage: {
          trend: 'stable',
          change: 0
        },
        duration: {
          trend: 'stable',
          change: 0
        },
        failures: {
          trend: 'stable',
          change: 0
        }
      };

      if (history.length >= 2) {
        const current = history[history.length - 1];
        const previous = history[history.length - 2];

        // Coverage trend
        const coverageChange = 
          current.coverage.statements - previous.coverage.statements;
        trends.coverage.change = coverageChange;
        trends.coverage.trend = coverageChange > 0 ? 'improving' : 
                              coverageChange < 0 ? 'declining' : 'stable';

        // Duration trend
        const durationChange = 
          ((current.duration - previous.duration) / previous.duration) * 100;
        trends.duration.change = durationChange;
        trends.duration.trend = durationChange > 10 ? 'slower' :
                              durationChange < -10 ? 'faster' : 'stable';

        // Failures trend
        const currentFailures = current.results.unit.failed + 
                              current.results.integration.failed + 
                              current.results.e2e.failed;
        const previousFailures = previous.results.unit.failed + 
                               previous.results.integration.failed + 
                               previous.results.e2e.failed;
        trends.failures.change = currentFailures - previousFailures;
        trends.failures.trend = currentFailures > previousFailures ? 'increasing' :
                              currentFailures < previousFailures ? 'decreasing' : 'stable';
      }

      return trends;
    } catch (error) {
      console.error('Error calculating trends:', error);
      return null;
    }
  }

  generateReport(results) {
    const reportFile = path.join(this.reportDir, 
      `test-report-${new Date().toISOString().split('T')[0]}.json`);
    
    const report = {
      summary: {
        timestamp: results.timestamp,
        duration: results.duration,
        totalTests: Object.values(results.results).reduce((sum, suite) => 
          sum + suite.total, 0),
        failedTests: Object.values(results.results).reduce((sum, suite) => 
          sum + suite.failed, 0),
        coverage: results.coverage,
        trends: results.trends
      },
      details: results
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`Report generated: ${reportFile}`);

    // If there are failures, send alert
    if (report.summary.failedTests > 0) {
      this.sendAlert('Test Failures', 
        `${report.summary.failedTests} tests failed. Check ${reportFile} for details.`);
    }

    // If coverage decreased, send alert
    if (results.trends?.coverage?.trend === 'declining') {
      this.sendAlert('Coverage Decrease', 
        `Test coverage decreased by ${Math.abs(results.trends.coverage.change)}%`);
    }
  }

  sendAlert(subject, message) {
    // Implement your alert mechanism here (email, Slack, etc.)
    console.error(`ALERT - ${subject}: ${message}`);
  }
}

// Execute if run directly
if (require.main === module) {
  const monitor = new TestMonitor();
  monitor.runTests()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = TestMonitor;
