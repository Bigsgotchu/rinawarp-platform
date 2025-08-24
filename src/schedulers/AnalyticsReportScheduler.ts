import { CronJob } from 'cron';
import AnalyticsEmailService from '../services/AnalyticsEmailService';
import logger from '../utils/logger';
import config from '../config';

class AnalyticsReportScheduler {
  private dailyReportJob: CronJob;
  private weeklyReportJob: CronJob;
  private monthlyReportJob: CronJob;

  constructor() {
    // Run daily report at 6 AM UTC
    this.dailyReportJob = new CronJob('0 6 * * *', async () => {
      try {
        await AnalyticsEmailService.sendDailyReport();
      } catch (error) {
        logger.error('Failed to send daily analytics report:', error);
      }
    }, null, false, 'UTC');

    // Run weekly report on Monday at 7 AM UTC
    this.weeklyReportJob = new CronJob('0 7 * * 1', async () => {
      try {
        await AnalyticsEmailService.sendWeeklyReport();
      } catch (error) {
        logger.error('Failed to send weekly analytics report:', error);
      }
    }, null, false, 'UTC');

    // Run monthly report on the 1st of each month at 8 AM UTC
    this.monthlyReportJob = new CronJob('0 8 1 * *', async () => {
      try {
        await AnalyticsEmailService.sendMonthlyReport();
      } catch (error) {
        logger.error('Failed to send monthly analytics report:', error);
      }
    }, null, false, 'UTC');
  }

  /**
   * Start all report schedulers
   */
  async start() {
    try {
      // Initialize email service
      await AnalyticsEmailService.initialize();

      // Start scheduled jobs if enabled in config
      if (config.analytics.reports.daily.enabled) {
        this.dailyReportJob.start();
        logger.info('Daily analytics report scheduler started');
      }

      if (config.analytics.reports.weekly.enabled) {
        this.weeklyReportJob.start();
        logger.info('Weekly analytics report scheduler started');
      }

      if (config.analytics.reports.monthly.enabled) {
        this.monthlyReportJob.start();
        logger.info('Monthly analytics report scheduler started');
      }

    } catch (error) {
      logger.error('Failed to start analytics report scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop all report schedulers
   */
  stop() {
    this.dailyReportJob.stop();
    this.weeklyReportJob.stop();
    this.monthlyReportJob.stop();
    logger.info('Analytics report schedulers stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      daily: {
        enabled: config.analytics.reports.daily.enabled,
        running: this.dailyReportJob.running,
        nextDate: this.dailyReportJob.nextDate()
      },
      weekly: {
        enabled: config.analytics.reports.weekly.enabled,
        running: this.weeklyReportJob.running,
        nextDate: this.weeklyReportJob.nextDate()
      },
      monthly: {
        enabled: config.analytics.reports.monthly.enabled,
        running: this.monthlyReportJob.running,
        nextDate: this.monthlyReportJob.nextDate()
      }
    };
  }
}

export default new AnalyticsReportScheduler();
