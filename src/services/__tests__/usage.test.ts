import { UsageTrackingService } from '../usage';
import { TerminalApiClient } from '../../api/terminal';
import { env } from '../../config/env';

// Mock TerminalApiClient
jest.mock('../../api/terminal', () => ({
  getInstance: jest.fn().mockReturnValue({
    trackUsage: jest.fn(),
    batchTrackUsage: jest.fn(),
  }),
}));

describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let mockClient: jest.Mocked<TerminalApiClient>;

  beforeEach(() => {
    jest.useFakeTimers();
    service = UsageTrackingService.getInstance();
    mockClient = TerminalApiClient.getInstance() as jest.Mocked<TerminalApiClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('trackUsage', () => {
    it('should send usage directly when batching is disabled', async () => {
      process.env.BATCH_USAGE_TRACKING = 'false';
      await resetEnv();
      
      await service.trackUsage('test', 1, { test: true });
      
      expect(mockClient.trackUsage).toHaveBeenCalledWith({
        type: 'test',
        quantity: 1,
        metadata: { test: true },
      });
    });

    it('should queue usage when batching is enabled', async () => {
      process.env.BATCH_USAGE_TRACKING = 'true';
      await resetEnv();
      
      await service.trackUsage('test', 1);
      
      expect(mockClient.trackUsage).not.toHaveBeenCalled();
      expect(service.getQueueSize()).toBe(1);
    });

    it('should flush queue when batch size is reached', async () => {
      process.env.BATCH_USAGE_TRACKING = 'true';
      process.env.USAGE_BATCH_SIZE = '2';
      await resetEnv();
      
      await service.trackUsage('test1', 1);
      await service.trackUsage('test2', 1);
      
      expect(mockClient.batchTrackUsage).toHaveBeenCalled();
      expect(service.getQueueSize()).toBe(0);
    });
  });

  describe('batch processing', () => {
    it('should aggregate similar events', async () => {
      process.env.BATCH_USAGE_TRACKING = 'true';
      await resetEnv();
      
      await service.trackUsage('test', 1, { meta: 'data' });
      await service.trackUsage('test', 2, { meta: 'data' });
      
      await service.forceFlush();
      
      expect(mockClient.batchTrackUsage).toHaveBeenCalledWith([
        {
          type: 'test',
          quantity: 3,
          metadata: { meta: 'data' },
        },
      ]);
    });

    it('should handle flush failures', async () => {
      process.env.BATCH_USAGE_TRACKING = 'true';
      await resetEnv();
      mockClient.batchTrackUsage.mockRejectedValueOnce(new Error('Test error'));
      
      await service.trackUsage('test', 1);
      await service.forceFlush();
      
      expect(service.getQueueSize()).toBe(1);
    });
  });

  describe('trackTokenUsage', () => {
    it('should track both prompt and completion tokens', async () => {
      process.env.BATCH_USAGE_TRACKING = 'false';
      await resetEnv();
      
      await service.trackTokenUsage(10, 20, { model: 'test' });
      
      expect(mockClient.trackUsage).toHaveBeenCalledTimes(2);
      expect(mockClient.trackUsage).toHaveBeenCalledWith({
        type: 'prompt_tokens',
        quantity: 10,
        metadata: { model: 'test' },
      });
      expect(mockClient.trackUsage).toHaveBeenCalledWith({
        type: 'completion_tokens',
        quantity: 20,
        metadata: { model: 'test' },
      });
    });
  });
});
