import { jest } from '@jest/globals';
import MonitoringService from '../../../services/monitoring/monitoring';
import UsageTrackingService from '../../../services/monitoring/usage-tracking';
import ClientAuthService from '../../../auth/client/services/auth';
import { db } from '../../../lib/db';
import { redis } from '../../../lib/redis';

// Mock dependencies
jest.mock('../../../lib/db');
jest.mock('../../../lib/redis');

describe('Core Services Tests', () => {
  describe('MonitoringService', () => {
    let monitoring: typeof MonitoringService;

    beforeEach(() => {
      monitoring = MonitoringService.getInstance();
    });

    it('should record and retrieve metrics', () => {
      monitoring.recordMetric('test.metric', 100, { tag: 'value' });
      const metrics = monitoring.getMetrics('test.metric');
      
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].tags).toEqual({ tag: 'value' });
    });

    it('should manage health checks', () => {
      monitoring.recordHealthCheck({
        name: 'test',
        status: 'healthy',
        message: 'OK',
      });

      const checks = monitoring.getHealthChecks();
      expect(checks).toHaveLength(1);
      expect(checks[0].status).toBe('healthy');
      expect(monitoring.isHealthy()).toBe(true);
    });

    it('should cleanup old metrics', () => {
      const oldTime = Date.now() - (25 * 3600 * 1000); // 25 hours ago
      
      // @ts-ignore - Access private method for testing
      monitoring.metrics.set('test.metric', [
        { name: 'test.metric', value: 100, timestamp: oldTime },
        { name: 'test.metric', value: 200, timestamp: Date.now() },
      ]);

      // @ts-ignore - Access private method for testing
      monitoring.cleanupMetrics('test.metric');

      const metrics = monitoring.getMetrics('test.metric');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(200);
    });
  });

  describe('UsageTrackingService', () => {
    let usageTracking: typeof UsageTrackingService;

    beforeEach(() => {
      usageTracking = UsageTrackingService.getInstance();
      jest.clearAllMocks();
    });

    it('should track AI usage', async () => {
      const mockCreate = jest.spyOn(db.aiUsage, 'create');
      const mockPipeline = jest.spyOn(redis, 'pipeline');

      await usageTracking.trackAIUsage({
        userId: 'test-user',
        model: 'gpt-4',
        prompt: 'test prompt',
        responseTokens: 100,
        promptTokens: 50,
        latency: 500,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user',
          model: 'gpt-4',
          responseTokens: 100,
          promptTokens: 50,
        }),
      });

      expect(mockPipeline).toHaveBeenCalled();
    });

    it('should track command usage', async () => {
      const mockCreate = jest.spyOn(db.commandUsage, 'create');
      const mockPipeline = jest.spyOn(redis, 'pipeline');

      await usageTracking.trackCommandUsage({
        userId: 'test-user',
        command: 'test-command',
        arguments: ['arg1', 'arg2'],
        duration: 100,
        success: true,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user',
          command: 'test-command',
          arguments: ['arg1', 'arg2'],
          success: true,
        }),
      });

      expect(mockPipeline).toHaveBeenCalled();
    });

    it('should get AI usage stats', async () => {
      const mockHgetall = jest.spyOn(redis, 'hgetall');
      const mockGet = jest.spyOn(redis, 'get');

      mockHgetall.mockResolvedValue({
        requests: '10',
        tokens: '1000',
      });
      mockGet.mockResolvedValue('1');

      const stats = await usageTracking.getAIUsageStats('test-user');

      expect(stats).toEqual({
        dailyRequests: 10,
        dailyTokens: 1000,
        currentRate: expect.any(Number),
      });
    });

    it('should get command stats', async () => {
      const mockHgetall = jest.spyOn(redis, 'hgetall');
      const mockHget = jest.spyOn(redis, 'hget');

      mockHgetall.mockResolvedValue({
        total_uses: '100',
        successful: '90',
        avg_duration: '150',
      });
      mockHget.mockResolvedValue('5');

      const stats = await usageTracking.getCommandStats('test-command');

      expect(stats).toEqual({
        totalUses: 100,
        successRate: 90,
        avgDuration: 150,
        recentUsage: expect.any(Array),
      });
    });
  });

  describe('ClientAuthService', () => {
    let authService: typeof ClientAuthService;

    beforeEach(() => {
      authService = ClientAuthService.getInstance({
        persistToken: true,
        tokenStorage: 'memory',
      });
    });

    it('should handle login', async () => {
      const mockLogin = jest.fn().mockResolvedValue({
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 'test-user',
          email: 'test@example.com',
        },
      });

      // @ts-ignore - Mock implementation
      authService.terminalApi = { login: mockLogin };

      await authService.login({
        email: 'test@example.com',
        password: 'test-password',
      });

      expect(mockLogin).toHaveBeenCalledWith(
        'test@example.com',
        'test-password'
      );
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getToken()).toBe('test-token');
    });

    it('should handle logout', async () => {
      // Set initial auth state
      // @ts-ignore - Access private method for testing
      authService.setAuth({
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 'test-user',
          email: 'test@example.com',
        },
      });

      await authService.logout();

      expect(authService.isAuthenticated()).toBe(false);
      expect(authService.getToken()).toBeNull();
      expect(authService.getUser()).toBeNull();
    });

    it('should validate authentication', async () => {
      const mockValidateAuth = jest.fn().mockResolvedValue(true);

      // @ts-ignore - Mock implementation
      authService.terminalApi = { validateAuth: mockValidateAuth };

      // Set initial auth state
      // @ts-ignore - Access private method for testing
      authService.setAuth({
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 'test-user',
          email: 'test@example.com',
        },
      });

      const isValid = await authService.validateAuth();

      expect(mockValidateAuth).toHaveBeenCalledWith('test-token');
      expect(isValid).toBe(true);
    });

    it('should handle token refresh', async () => {
      const mockRefreshToken = jest.fn().mockResolvedValue({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'test-user',
          email: 'test@example.com',
        },
      });

      // @ts-ignore - Mock implementation
      authService.terminalApi = { refreshToken: mockRefreshToken };

      // @ts-ignore - Access private method for testing
      await authService.refreshAuth('test-refresh-token');

      expect(mockRefreshToken).toHaveBeenCalledWith('test-refresh-token');
      expect(authService.getToken()).toBe('new-token');
    });
  });
});
