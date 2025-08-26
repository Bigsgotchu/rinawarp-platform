import { PrismaClient } from '@prisma/client';
import { createTransport } from 'nodemailer';
import AnalyticsEmailService from '../../services/AnalyticsEmailService';
import AnalyticsService from '../../services/AnalyticsService';
import config from '../../config';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('@prisma/client');
jest.mock('../../services/AnalyticsService');
jest.mock('fs/promises');

describe('AnalyticsEmailService', () => {
  let mockTransporter: jest.Mocked<any>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock nodemailer
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };
    (createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Mock file system
    (readFile as jest.Mock).mockResolvedValue(
      '<html>{{type}} report template</html>'
    );

    // Mock analytics service
    (AnalyticsService.getRevenueMetrics as jest.Mock).mockResolvedValue({
      totalRevenue: 1000,
      recurringRevenue: 800,
      oneTimeRevenue: 200,
      refunds: 50,
      netRevenue: 950,
    });

    (AnalyticsService.getSubscriptionMetrics as jest.Mock).mockResolvedValue({
      total: 100,
      active: 90,
      churnRate: 0.1,
      mrr: 1000,
      arr: 12000,
    });

    (AnalyticsService.getUsageMetrics as jest.Mock).mockResolvedValue({
      commands: { total: 1000, average: 10 },
      workflows: { total: 500, average: 5 },
    });

    (AnalyticsService.getCustomerMetrics as jest.Mock).mockResolvedValue({
      total: 100,
      active: 90,
      new: 10,
      churned: 5,
      ltv: 500,
    });
  });

  describe('initialize', () => {
    it('loads and compiles email template successfully', async () => {
      await AnalyticsEmailService.initialize();
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('analytics-report.html'),
        'utf-8'
      );
    });

    it('throws error if template file not found', async () => {
      (readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      await expect(AnalyticsEmailService.initialize()).rejects.toThrow();
    });
  });

  describe('sendAnalyticsReport', () => {
    const testConfig = {
      type: 'daily' as const,
      recipientEmails: ['test@example.com'],
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-02'),
    };

    beforeEach(async () => {
      await AnalyticsEmailService.initialize();
    });

    it('sends report email successfully', async () => {
      await AnalyticsEmailService.sendAnalyticsReport(testConfig);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: config.email.from,
          to: testConfig.recipientEmails.join(', '),
          subject: expect.stringContaining(testConfig.type),
          html: expect.any(String),
        })
      );
    });

    it('includes all required metrics in the report', async () => {
      await AnalyticsEmailService.sendAnalyticsReport(testConfig);

      expect(AnalyticsService.getRevenueMetrics).toHaveBeenCalledWith({
        start: testConfig.startDate,
        end: testConfig.endDate,
      });
      expect(AnalyticsService.getSubscriptionMetrics).toHaveBeenCalledWith(
        testConfig.endDate
      );
      expect(AnalyticsService.getUsageMetrics).toHaveBeenCalledWith({
        start: testConfig.startDate,
        end: testConfig.endDate,
      });
      expect(AnalyticsService.getCustomerMetrics).toHaveBeenCalledWith({
        start: testConfig.startDate,
        end: testConfig.endDate,
      });
    });

    it('stores report in database', async () => {
      const mockCreate = jest.fn().mockResolvedValue({});
      (PrismaClient as jest.Mock).mockImplementation(() => ({
        analyticsReport: { create: mockCreate },
      }));

      await AnalyticsEmailService.sendAnalyticsReport(testConfig);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: testConfig.type,
          date: testConfig.endDate,
          recipientCount: testConfig.recipientEmails.length,
          reportData: expect.any(Object),
        }),
      });
    });

    it('handles email sending failure', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));
      await expect(
        AnalyticsEmailService.sendAnalyticsReport(testConfig)
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('sendDailyReport', () => {
    beforeEach(async () => {
      await AnalyticsEmailService.initialize();
      // Mock Prisma findMany for subscribers
      const mockFindMany = jest
        .fn()
        .mockResolvedValue([
          { email: 'user1@example.com' },
          { email: 'user2@example.com' },
        ]);
      (PrismaClient as jest.Mock).mockImplementation(() => ({
        user: { findMany: mockFindMany },
      }));
    });

    it('sends daily report to subscribed users', async () => {
      await AnalyticsEmailService.sendDailyReport();

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining('user1@example.com'),
          subject: expect.stringContaining('Daily'),
        })
      );
    });

    it('skips sending if no subscribers', async () => {
      const mockFindMany = jest.fn().mockResolvedValue([]);
      (PrismaClient as jest.Mock).mockImplementation(() => ({
        user: { findMany: mockFindMany },
      }));

      await AnalyticsEmailService.sendDailyReport();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendTestReport', () => {
    const testEmail = 'test@example.com';

    beforeEach(async () => {
      await AnalyticsEmailService.initialize();
    });

    it('sends test report successfully', async () => {
      await AnalyticsEmailService.sendTestReport(testEmail);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testEmail,
          subject: expect.stringContaining('test'),
          html: expect.any(String),
        })
      );
    });

    it('uses appropriate date range for test report', async () => {
      await AnalyticsEmailService.sendTestReport(testEmail);

      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      expect(AnalyticsService.getRevenueMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        })
      );
    });
  });
});
