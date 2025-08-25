import { CronJob } from 'cron';
import AnalyticsReportScheduler from '../../schedulers/AnalyticsReportScheduler';
import AnalyticsEmailService from '../../services/AnalyticsEmailService';
import config from '../../config';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('cron');
jest.mock('../../services/AnalyticsEmailService');
jest.mock('../../utils/logger');

describe('AnalyticsReportScheduler', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset configuration
    (config.analytics as any).reports = {
      daily: {
        enabled: true,
        time: '06:00'
      },
      weekly: {
        enabled: true,
        time: '07:00',
        day: 1
      },
      monthly: {
        enabled: true,
        time: '08:00',
        day: 1
      }
    };
  });

  describe('start', () => {
    it('initializes email service', async () => {
      await AnalyticsReportScheduler.start();
      expect(AnalyticsEmailService.initialize).toHaveBeenCalled();
    });

    it('starts all enabled report jobs', async () => {
      await AnalyticsReportScheduler.start();

      expect(CronJob).toHaveBeenCalledTimes(3); // One for each report type
      const cronInstances = (CronJob as jest.Mock).mock.instances;
      cronInstances.forEach(instance => {
        expect(instance.start).toHaveBeenCalled();
      });
    });

    it('only starts enabled report jobs', async () => {
      ((config.analytics as any).reports.daily as any).enabled = false;
      ((config.analytics as any).reports.weekly as any).enabled = false;

      await AnalyticsReportScheduler.start();

      expect(CronJob).toHaveBeenCalledTimes(1); // Only monthly job
      const cronInstances = (CronJob as jest.Mock).mock.instances;
      expect(cronInstances[0].start).toHaveBeenCalled();
    });

    it('handles initialization errors', async () => {
      const error = new Error('Initialization failed');
      (AnalyticsEmailService.initialize as jest.Mock).mockRejectedValue(error);

      await expect(AnalyticsReportScheduler.start()).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to start analytics report scheduler:',
        error
      );
    });
  });

  describe('stop', () => {
    it('stops all running jobs', async () => {
      await AnalyticsReportScheduler.start();
      AnalyticsReportScheduler.stop();

      const cronInstances = (CronJob as jest.Mock).mock.instances;
      cronInstances.forEach(instance => {
        expect(instance.stop).toHaveBeenCalled();
      });
    });
  });

  describe('getStatus', () => {
    it('returns status of all jobs', async () => {
      await AnalyticsReportScheduler.start();

      // Mock running status and next dates
      const nextDate = new Date();
      const cronInstances = (CronJob as jest.Mock).mock.instances;
      cronInstances.forEach(instance => {
        instance.running = true;
        instance.nextDate = jest.fn().mockReturnValue(nextDate);
      });

      const status = AnalyticsReportScheduler.getStatus();

      expect(status).toEqual({
        daily: {
          enabled: true,
          running: true,
          nextDate
        },
        weekly: {
          enabled: true,
          running: true,
          nextDate
        },
        monthly: {
          enabled: true,
          running: true,
          nextDate
        }
      });
    });

    it('reflects disabled jobs in status', async () => {
      ((config.analytics as any).reports.daily as any).enabled = false;
      await AnalyticsReportScheduler.start();

      const status = AnalyticsReportScheduler.getStatus();

      expect(status.daily.enabled).toBe(false);
      expect(status.weekly.enabled).toBe(true);
      expect(status.monthly.enabled).toBe(true);
    });
  });

  describe('report execution', () => {
    it('executes daily report job', async () => {
      // Get the callback function passed to CronJob constructor
      await AnalyticsReportScheduler.start();
      const [, callback] = (CronJob as jest.Mock).mock.calls[0];

      // Execute the callback
      await callback();

      expect(AnalyticsEmailService.sendDailyReport).toHaveBeenCalled();
    });

    it('executes weekly report job', async () => {
      await AnalyticsReportScheduler.start();
      const [, callback] = (CronJob as jest.Mock).mock.calls[1];

      await callback();

      expect(AnalyticsEmailService.sendWeeklyReport).toHaveBeenCalled();
    });

    it('executes monthly report job', async () => {
      await AnalyticsReportScheduler.start();
      const [, callback] = (CronJob as jest.Mock).mock.calls[2];

      await callback();

      expect(AnalyticsEmailService.sendMonthlyReport).toHaveBeenCalled();
    });

    it('handles report execution errors', async () => {
      const error = new Error('Report generation failed');
      (AnalyticsEmailService.sendDailyReport as jest.Mock).mockRejectedValue(error);

      await AnalyticsReportScheduler.start();
      const [, callback] = (CronJob as jest.Mock).mock.calls[0];

      await callback();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send daily analytics report:',
        error
      );
    });
  });
});
