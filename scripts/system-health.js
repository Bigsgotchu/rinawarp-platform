#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SystemHealthCheck {
  constructor() {
    this.healthChecks = {
      'Task Scheduler': this.checkTaskScheduler.bind(this),
      'Database': this.checkDatabase.bind(this),
      'Redis': this.checkRedis.bind(this),
      'Monitoring': this.checkMonitoring.bind(this),
      'Logging': this.checkLogging.bind(this),
      'Disk Space': this.checkDiskSpace.bind(this),
      'Memory Usage': this.checkMemoryUsage.bind(this),
      'CPU Load': this.checkCPULoad.bind(this),
      'Task History': this.checkTaskHistory.bind(this),
      'Backup Status': this.checkBackupStatus.bind(this)
    };
  }

  async runHealthCheck() {
    console.log('Starting system health check...');
    
    const results = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
      recommendations: []
    };

    for (const [name, check] of Object.entries(this.healthChecks)) {
      try {
        console.log(`Checking ${name}...`);
        const result = await check();
        results.checks[name] = result;
        
        if (result.status === 'critical') {
          results.status = 'critical';
        } else if (result.status === 'warning' && results.status !== 'critical') {
          results.status = 'warning';
        }

        if (result.recommendations) {
          results.recommendations.push(...result.recommendations);
        }
      } catch (error) {
        console.error(`Error checking ${name}:`, error);
        results.checks[name] = {
          status: 'critical',
          error: error.message
        };
        results.status = 'critical';
      }
    }

    // Generate report
    await this.generateReport(results);
    
    return results;
  }

  async checkTaskScheduler() {
    const processCheck = await execAsync('ps aux | grep task-scheduler');
    const logsCheck = await this.checkRecentLogs('task-scheduler');
    const tasksCheck = await this.checkTaskDefinitions();

    return {
      status: this.calculateStatus([
        processCheck ? 'healthy' : 'critical',
        logsCheck.status,
        tasksCheck.status
      ]),
      details: {
        process: processCheck ? 'running' : 'not running',
        logs: logsCheck,
        tasks: tasksCheck
      },
      recommendations: [
        ...logsCheck.recommendations || [],
        ...tasksCheck.recommendations || []
      ]
    };
  }

  async checkDatabase() {
    try {
      const { stdout } = await execAsync('psql -c "\\l"');
      const connectionCount = await this.getDatabaseConnections();
      const replicationLag = await this.getReplicationLag();

      return {
        status: this.calculateStatus([
          'healthy',
          connectionCount > 80 ? 'warning' : 'healthy',
          replicationLag > 300 ? 'warning' : 'healthy'
        ]),
        details: {
          connections: connectionCount,
          replicationLag,
          databases: stdout
        },
        recommendations: [
          connectionCount > 80 ? 'High number of database connections' : null,
          replicationLag > 300 ? 'High replication lag detected' : null
        ].filter(Boolean)
      };
    } catch (error) {
      return {
        status: 'critical',
        error: error.message,
        recommendations: ['Database connection failed']
      };
    }
  }

  async checkRedis() {
    try {
      const { stdout } = await execAsync('redis-cli ping');
      const info = await this.getRedisInfo();

      return {
        status: stdout === 'PONG' ? 'healthy' : 'critical',
        details: info,
        recommendations: this.generateRedisRecommendations(info)
      };
    } catch (error) {
      return {
        status: 'critical',
        error: error.message,
        recommendations: ['Redis connection failed']
      };
    }
  }

  async checkMonitoring() {
    const checks = [
      await this.checkPrometheus(),
      await this.checkGrafana(),
      await this.checkAlertManager()
    ];

    return {
      status: this.calculateStatus(checks.map(c => c.status)),
      details: {
        prometheus: checks[0],
        grafana: checks[1],
        alertmanager: checks[2]
      },
      recommendations: checks.flatMap(c => c.recommendations || [])
    };
  }

  async checkLogging() {
    const logFiles = await this.getRecentLogs();
    const logSpace = await this.getLogSpaceUsage();
    const rotationStatus = await this.checkLogRotation();

    return {
      status: this.calculateStatus([
        logFiles.status,
        logSpace > 80 ? 'warning' : 'healthy',
        rotationStatus.status
      ]),
      details: {
        files: logFiles,
        spaceUsage: `${logSpace}%`,
        rotation: rotationStatus
      },
      recommendations: [
        logSpace > 80 ? 'High log space usage' : null,
        ...rotationStatus.recommendations || []
      ].filter(Boolean)
    };
  }

  async checkDiskSpace() {
    const { stdout } = await execAsync('df -h');
    const partitions = this.parseDfOutput(stdout);
    const status = partitions.some(p => p.usagePercent > 90) ? 'critical' :
                  partitions.some(p => p.usagePercent > 80) ? 'warning' : 'healthy';

    return {
      status,
      details: partitions,
      recommendations: partitions
        .filter(p => p.usagePercent > 80)
        .map(p => `High disk usage on ${p.mountpoint}: ${p.usagePercent}%`)
    };
  }

  async checkMemoryUsage() {
    const { stdout } = await execAsync('free -m');
    const memory = this.parseMemoryOutput(stdout);
    const usagePercent = (memory.total - memory.available) / memory.total * 100;

    return {
      status: usagePercent > 90 ? 'critical' :
              usagePercent > 80 ? 'warning' : 'healthy',
      details: memory,
      recommendations: usagePercent > 80 ? ['High memory usage detected'] : []
    };
  }

  async checkCPULoad() {
    const { stdout } = await execAsync('uptime');
    const loads = this.parseLoadAverage(stdout);
    const cpuCount = require('os').cpus().length;
    const highLoad = loads.some(load => load > cpuCount);

    return {
      status: highLoad ? 'warning' : 'healthy',
      details: {
        loadAverages: loads,
        cpuCount
      },
      recommendations: highLoad ? ['High CPU load detected'] : []
    };
  }

  async checkTaskHistory() {
    const recentTasks = await this.getRecentTaskExecutions();
    const failureRate = this.calculateFailureRate(recentTasks);

    return {
      status: failureRate > 20 ? 'critical' :
              failureRate > 10 ? 'warning' : 'healthy',
      details: {
        recentTasks,
        failureRate: `${failureRate}%`
      },
      recommendations: failureRate > 10 ? ['High task failure rate detected'] : []
    };
  }

  async checkBackupStatus() {
    const lastBackup = await this.getLastBackupTime();
    const backupSize = await this.getLastBackupSize();
    const verificationStatus = await this.checkBackupVerification();

    const hoursSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60);

    return {
      status: hoursSinceBackup > 48 ? 'critical' :
              hoursSinceBackup > 24 ? 'warning' : 'healthy',
      details: {
        lastBackup: new Date(lastBackup).toISOString(),
        backupSize,
        verification: verificationStatus
      },
      recommendations: [
        hoursSinceBackup > 24 ? 'Backup is outdated' : null,
        verificationStatus.status !== 'healthy' ? 'Backup verification failed' : null
      ].filter(Boolean)
    };
  }

  // Helper methods
  calculateStatus(statuses) {
    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('warning')) return 'warning';
    return 'healthy';
  }

  async generateReport(results) {
    const reportFile = path.join(
      __dirname,
      '../reports/health',
      `health-check-${new Date().toISOString().split('T')[0]}.json`
    );

    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(reportFile), { recursive: true });

    // Write report
    await fs.promises.writeFile(
      reportFile,
      JSON.stringify(results, null, 2)
    );

    console.log(`Health check report generated: ${reportFile}`);

    // Send notifications if needed
    if (results.status !== 'healthy') {
      await this.sendNotifications(results);
    }
  }

  async sendNotifications(results) {
    // Implementation depends on your notification system
    console.log('Sending notifications for health check results...');
  }

  // Additional helper methods would be implemented here
}

// Execute if run directly
if (require.main === module) {
  const healthCheck = new SystemHealthCheck();
  healthCheck.runHealthCheck()
    .then(results => {
      console.log('Health check completed:', results.status);
      process.exit(results.status === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

module.exports = SystemHealthCheck;
