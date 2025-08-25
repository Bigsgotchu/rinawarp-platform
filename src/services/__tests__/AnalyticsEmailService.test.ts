import { PrismaClient } from '@prisma/client';
import { createTransport } from 'nodemailer';
import AnalyticsEmailService from '../AnalyticsEmailService';
import { ReportType } from '../../types/analytics';
import { format } from 'date-fns';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('nodemailer');
jest.mock('../../utils/logger');

describe('AnalyticsEmailService', () => {
  let service: AnalyticsEmailService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockTransporter: jest.Mocked<ReturnType<typeof createTransport>>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock nodemailer
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
    } as any;
    (createTransport as jest.Mock).mockReturnValue(mockTransporter);

    // Mock Prisma
    mockPrisma = {
      user: {
        findMany: jest.fn(),
      },
      analyticsReport: {
        create: jest.fn(),
      },
    } as any;

    // Initialize service
    service = new AnalyticsEmailService();
  });

  describe('sendDailyReport', () => {
    it('should send daily report to active subscribers', async () => {
      const subscribers = [
        { id: '1', email: 'user1@test.com' },
        { id: '2', email: 'user2@test.com' },
      ];

      mockPrisma.user.findMany.mockResolvedValue(subscribers);

      const result = await service.sendDailyReport();

      expect(result).toEqual({
        success: true,
        recipientCount: 2,
        type: 'DAILY',
        interval: {
          start: expect.any(Date),
          end: expect.any(Date),
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      expect(mockPrisma.analyticsReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'DAILY',
          recipientCount: 2,
        }),
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB Error'));

      await expect(service.sendDailyReport()).rejects.toThrow('Failed to send daily report');
    });
  });

  describe('sendWeeklyReport', () => {
    it('should send weekly report to active subscribers', async () => {
      const subscribers = [
        { id: '1', email: 'user1@test.com' },
        { id: '2', email: 'user2@test.com' },
      ];

      mockPrisma.user.findMany.mockResolvedValue(subscribers);

      const result = await service.sendWeeklyReport();

      expect(result).toEqual({
        success: true,
        recipientCount: 2,
        type: 'WEEKLY',
        interval: {
          start: expect.any(Date),
          end: expect.any(Date),
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      expect(mockPrisma.analyticsReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'WEEKLY',
          recipientCount: 2,
        }),
      });
    });
  });

  describe('sendMonthlyReport', () => {
    it('should send monthly report to active subscribers', async () => {
      const subscribers = [
        { id: '1', email: 'user1@test.com' },
        { id: '2', email: 'user2@test.com' },
      ];

      mockPrisma.user.findMany.mockResolvedValue(subscribers);

      const result = await service.sendMonthlyReport();

      expect(result).toEqual({
        success: true,
        recipientCount: 2,
        type: 'MONTHLY',
        interval: {
          start: expect.any(Date),
          end: expect.any(Date),
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
      expect(mockPrisma.analyticsReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'MONTHLY',
          recipientCount: 2,
        }),
      });
    });
  });

  describe('testReportDelivery', () => {
    it('should send test email successfully', async () => {
      const result = await service.testReportDelivery('test@example.com');

      expect(result).toEqual({
        success: true,
        recipientCount: 1,
        type: 'TEST',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('Test Report'),
        })
      );
    });

    it('should handle delivery errors', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP Error'));

      await expect(service.testReportDelivery('test@example.com')).rejects.toThrow(
        'Failed to send test email'
      );
    });
  });
});
