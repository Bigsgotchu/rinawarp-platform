import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import AnalyticsSubscriptionController from '../../controllers/AnalyticsSubscriptionController';
import UnsubscribeTokenService from '../../services/UnsubscribeTokenService';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../services/UnsubscribeTokenService');

describe('AnalyticsSubscriptionController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock request object
    mockReq = {
      user: { userId: 'test-user-123', email: 'test@example.com', role: 'USER', plan: 'free' as any },
      query: {},
      body: {}
    };

    // Mock response object
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    // Mock next function
    mockNext = jest.fn();

    // Mock Prisma client
    const mockFindUnique = jest.fn();
    const mockUpdate = jest.fn();
    mockPrisma = {
      user: {
        findUnique: mockFindUnique,
        update: mockUpdate
      }
    } as unknown as jest.Mocked<PrismaClient>;
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  describe('getSubscriptionPreferences', () => {
    it('returns user preferences successfully', async () => {
      const mockPreferences = {
        dailyAnalytics: true,
        weeklyAnalytics: false,
        monthlyAnalytics: true
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        emailPreferences: mockPreferences
      });

      await AnalyticsSubscriptionController.getSubscriptionPreferences(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockReq.user!.userId },
        select: { emailPreferences: true }
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockPreferences);
    });

    it('handles user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await AnalyticsSubscriptionController.getSubscriptionPreferences(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('handles database errors', async () => {
      const error = new Error('Database error');
      mockPrisma.user.findUnique.mockRejectedValue(error);

      await AnalyticsSubscriptionController.getSubscriptionPreferences(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateSubscriptionPreferences', () => {
    const validPreferences = {
      dailyAnalytics: true,
      weeklyAnalytics: false,
      monthlyAnalytics: true
    };

    beforeEach(() => {
      mockReq.body = validPreferences;
    });

    it('updates preferences successfully', async () => {
      mockPrisma.user.update.mockResolvedValue({
        emailPreferences: validPreferences
      });

      await AnalyticsSubscriptionController.updateSubscriptionPreferences(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockReq.user!.userId },
        data: { emailPreferences: validPreferences },
        select: { emailPreferences: true }
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Subscription preferences updated successfully',
        preferences: validPreferences
      });
    });

    it('handles validation errors', async () => {
      mockReq.body = {
        dailyAnalytics: 'invalid',
        weeklyAnalytics: 123,
        monthlyAnalytics: null
      };

      // Mock express-validator's validationResult
      const errors = {
        isEmpty: () => false,
        array: () => [{
          param: 'dailyAnalytics',
          msg: 'Must be a boolean'
        }]
      };
      require('express-validator').validationResult = jest.fn().mockReturnValue(errors);

      await AnalyticsSubscriptionController.updateSubscriptionPreferences(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        errors: expect.any(Array)
      });
    });

    it('handles database errors', async () => {
      const error = new Error('Database error');
      mockPrisma.user.update.mockRejectedValue(error);

      await AnalyticsSubscriptionController.updateSubscriptionPreferences(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('unsubscribe', () => {
    const validQuery = {
      userId: 'test-user-123',
      type: 'daily',
      token: 'valid-token'
    };

    beforeEach(() => {
      mockReq.query = validQuery;
      (UnsubscribeTokenService.verifyToken as jest.Mock).mockReturnValue(true);
    });

    it('unsubscribes user successfully', async () => {
      const currentPreferences = {
        dailyAnalytics: true,
        weeklyAnalytics: true,
        monthlyAnalytics: true
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        emailPreferences: currentPreferences
      });

      mockPrisma.user.update.mockResolvedValue({
        emailPreferences: {
          ...currentPreferences,
          dailyAnalytics: false
        }
      });

      await AnalyticsSubscriptionController.unsubscribe(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(UnsubscribeTokenService.verifyToken).toHaveBeenCalledWith(
        validQuery.token,
        validQuery.userId,
        validQuery.type
      );

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Successfully unsubscribed from daily analytics reports'
      });
    });

    it('rejects invalid tokens', async () => {
      (UnsubscribeTokenService.verifyToken as jest.Mock).mockReturnValue(false);

      await AnalyticsSubscriptionController.unsubscribe(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid unsubscribe token'
      });
    });

    it('handles invalid report types', async () => {
      mockReq.query = {
        ...validQuery,
        type: 'invalid-type'
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        emailPreferences: {}
      });

      await AnalyticsSubscriptionController.unsubscribe(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid report type'
      });
    });

    it('handles user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await AnalyticsSubscriptionController.unsubscribe(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User not found'
      });
    });
  });
});
