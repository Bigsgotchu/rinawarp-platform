import { DebugCommand } from '../debug';
import { CommandContext } from '../../command';
import AIService from '../../../ai/service';
import { AIMessage } from '../../../ai/types';

// Mock dependencies
jest.mock('../../../ai/service', () => ({
  getInstance: jest.fn().mockReturnValue({
    chat: jest.fn(),
  }),
}));

describe('DebugCommand', () => {
  let command: DebugCommand;
  let mockAIService: jest.Mocked<typeof AIService>;
  const context: CommandContext = {
    cwd: '/test',
    env: {},
    user: {
      id: 'test-user',
      subscription: {
        planId: 'pro',
        features: ['ai_assistant'],
      },
    },
  };

  const mockAIResponse: AIMessage = {
    id: 'test',
    message: {
      role: 'assistant',
      content: 'Test response',
      functionCall: {
        name: 'start_debug_session',
        arguments: JSON.stringify({
          error: {
            message: 'Test error',
            stack: 'Error: Test error\n  at test.js:1:1',
          },
        }),
      },
    },
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.001,
    },
    model: {
      id: 'test-model',
      name: 'Test Model',
      provider: 'groq',
      maxTokens: 1000,
      supportsFunctions: true,
      supportsVision: false,
      costPerToken: 0.0001,
    },
  };

  beforeEach(() => {
    command = new DebugCommand(context);
    mockAIService = AIService.getInstance() as jest.Mocked<typeof AIService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should require input', async () => {
      const result = await command.execute({
        command: 'debug',
        args: [],
        options: {},
        raw: 'debug',
        timestamp: Date.now(),
      });

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('please provide');
    });

    it('should start debug session', async () => {
      mockAIService.chat.mockResolvedValue(mockAIResponse);

      const result = await command.execute({
        command: 'debug',
        args: ['Test error message'],
        options: {},
        raw: 'debug Test error message',
        timestamp: Date.now(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Debug Session Started');
      expect(result.output).toContain('Test error');
    });

    it('should handle AI errors', async () => {
      const error = new Error('AI error');
      mockAIService.chat.mockRejectedValue(error);

      const result = await command.execute({
        command: 'debug',
        args: ['Test error'],
        options: {},
        raw: 'debug Test error',
        timestamp: Date.now(),
      });

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('AI error');
      expect(result.error).toBe(error);
    });
  });

  describe('solution handling', () => {
    const mockShowSolutionsResponse: AIMessage = {
      ...mockAIResponse,
      message: {
        role: 'assistant',
        content: '',
        functionCall: {
          name: 'show_solutions',
          arguments: JSON.stringify({
            format: 'detailed',
          }),
        },
      },
    };

    beforeEach(async () => {
      // Start a session first
      mockAIService.chat.mockResolvedValue(mockAIResponse);
      await command.execute({
        command: 'debug',
        args: ['Test error'],
        options: {},
        raw: 'debug Test error',
        timestamp: Date.now(),
      });
      jest.clearAllMocks();
    });

    it('should show solutions', async () => {
      mockAIService.chat.mockResolvedValue(mockShowSolutionsResponse);

      const result = await command.execute({
        command: 'debug',
        args: ['show', 'solutions'],
        options: {},
        raw: 'debug show solutions',
        timestamp: Date.now(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Solutions');
    });
  });

  describe('step execution', () => {
    const mockExecuteStepResponse: AIMessage = {
      ...mockAIResponse,
      message: {
        role: 'assistant',
        content: '',
        functionCall: {
          name: 'execute_step',
          arguments: JSON.stringify({
            step: 'Test step',
          }),
        },
      },
    };

    beforeEach(async () => {
      // Start a session first
      mockAIService.chat.mockResolvedValue(mockAIResponse);
      await command.execute({
        command: 'debug',
        args: ['Test error'],
        options: {},
        raw: 'debug Test error',
        timestamp: Date.now(),
      });
      jest.clearAllMocks();
    });

    it('should execute step', async () => {
      mockAIService.chat.mockResolvedValue(mockExecuteStepResponse);

      const result = await command.execute({
        command: 'debug',
        args: ['execute', 'Test step'],
        options: {},
        raw: 'debug execute Test step',
        timestamp: Date.now(),
      });

      expect(result.exitCode).toBe(0);
      expect(result.metadata).toEqual(
        expect.objectContaining({
          stepId: expect.any(String),
          success: true,
        })
      );
    });

    it('should handle step execution errors', async () => {
      const error = new Error('Step error');
      mockAIService.chat.mockRejectedValue(error);

      const result = await command.execute({
        command: 'debug',
        args: ['execute', 'Test step'],
        options: {},
        raw: 'debug execute Test step',
        timestamp: Date.now(),
      });

      expect(result.exitCode).toBe(1);
      expect(result.error).toBe(error);
    });
  });
});
