#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const yaml = require('js-yaml');

class TaskScheduler {
  constructor() {
    this.taskDefinitionsFile = path.join(__dirname, '../config/tasks.yml');
    this.tasksDir = path.join(__dirname, '../tasks');
    this.logsDir = path.join(__dirname, '../logs/tasks');
    this.reportsDir = path.join(__dirname, '../reports/tasks');
    
    // Ensure directories exist
    [this.tasksDir, this.logsDir, this.reportsDir].forEach(dir => {
      fs.mkdirSync(dir, { recursive: true });
    });
    
    // Initialize notification system
    this.initializeNotifications();
  }

  async start() {
    console.log('Starting task scheduler...');
    
    try {
      // Load task definitions
      const tasks = this.loadTaskDefinitions();
      
      // Schedule all tasks
      this.scheduleTasks(tasks);
      
      console.log('Task scheduler started successfully');
    } catch (error) {
      console.error('Error starting task scheduler:', error);
      throw error;
    }
  }

  loadTaskDefinitions() {
    try {
      const taskConfig = yaml.load(fs.readFileSync(this.taskDefinitionsFile, 'utf8'));
      return taskConfig.tasks;
    } catch (error) {
      console.error('Error loading task definitions:', error);
      throw error;
    }
  }

  scheduleTasks(tasks) {
    tasks.forEach(task => {
      if (!task.schedule || !task.command) {
        console.warn(`Skipping invalid task: ${task.name}`);
        return;
      }

      cron.schedule(task.schedule, () => {
        this.executeTask(task);
      }, {
        timezone: 'UTC'
      });

      console.log(`Scheduled task: ${task.name} (${task.schedule})`);
    });
  }

  async executeTask(task) {
    console.log(`Executing task: ${task.name}`);
    
    const startTime = Date.now();
    const logFile = path.join(this.logsDir, `${task.name}-${new Date().toISOString()}.log`);
    
    try {
      // Create log stream
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      
      // Execute task
      const result = await new Promise((resolve, reject) => {
        exec(task.command, {
          cwd: process.cwd(),
          env: { ...process.env, ...task.environment }
        }, (error, stdout, stderr) => {
          if (error) {
            logStream.write(`Error: ${error.message}\n`);
            logStream.write(`stderr: ${stderr}\n`);
            reject(error);
            return;
          }
          
          logStream.write(stdout);
          resolve(stdout);
        });
      });

      // Calculate duration
      const duration = Date.now() - startTime;
      
      // Generate execution report
      const report = this.generateTaskReport(task, {
        status: 'success',
        duration,
        output: result,
        logFile
      });

      // Save report
      this.saveTaskReport(task.name, report);
      
      // Send notification if configured
      if (task.notify) {
        await this.sendNotification({
          subject: `Task ${task.name} completed successfully`,
          body: this.generateNotificationBody(task, report)
        });
      }

      console.log(`Task ${task.name} completed successfully`);
      return report;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Generate failure report
      const report = this.generateTaskReport(task, {
        status: 'failure',
        duration,
        error: error.message,
        logFile
      });

      // Save report
      this.saveTaskReport(task.name, report);
      
      // Always notify on failure
      await this.sendNotification({
        subject: `Task ${task.name} failed`,
        body: this.generateNotificationBody(task, report)
      });

      console.error(`Task ${task.name} failed:`, error);
      throw error;
    }
  }

  generateTaskReport(task, execution) {
    return {
      taskName: task.name,
      taskType: task.type,
      schedule: task.schedule,
      execution: {
        timestamp: new Date().toISOString(),
        ...execution
      }
    };
  }

  saveTaskReport(taskName, report) {
    const reportFile = path.join(
      this.reportsDir,
      `${taskName}-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }

  initializeNotifications() {
    // Initialize email transport
    this.emailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  async sendNotification({ subject, body }) {
    try {
      await this.emailTransport.sendMail({
        from: process.env.EMAIL_FROM,
        to: process.env.ALERT_EMAIL,
        subject,
        html: body
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  generateNotificationBody(task, report) {
    return `
      <h1>Task Execution Report</h1>
      <h2>${task.name}</h2>
      <p><strong>Status:</strong> ${report.execution.status}</p>
      <p><strong>Duration:</strong> ${report.execution.duration}ms</p>
      <p><strong>Timestamp:</strong> ${report.execution.timestamp}</p>
      
      ${report.execution.error ? `
        <h3>Error</h3>
        <pre>${report.execution.error}</pre>
      ` : ''}
      
      <h3>Log File</h3>
      <p>${report.execution.logFile}</p>
      
      ${report.execution.output ? `
        <h3>Output</h3>
        <pre>${report.execution.output}</pre>
      ` : ''}
    `;
  }
}

// Execute if run directly
if (require.main === module) {
  const scheduler = new TaskScheduler();
  scheduler.start()
    .then(() => {
      console.log('Task scheduler running...');
    })
    .catch(error => {
      console.error('Failed to start task scheduler:', error);
      process.exit(1);
    });
}

module.exports = TaskScheduler;
