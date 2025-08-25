import { DebugSession, DebugContext } from '../session';
import AIService from '../../../ai/service';
import { AIMessage } from '../../../ai/types';

// Mock dependencies
jest.mock('../../../ai/service', () => ({
  getInstance: jest.fn().mockReturnValue({
    chat: jest.fn(),
  }),
}));

describe('DebugSession', () => {
  let session: DebugSession;
  let mockAIService: jest.Mocked<typeof AIService>;
  const mockContext: DebugContext = {
    error: {
      message: 'Test error',
      stack: 'Error: Test error\n  at test.js:1:1',
    },
  };

  const mockAIResponse: AIMessage = {
    messageId: 'test',
    message: {
      role: 'assistant',
      content: 'Test analysis',
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

  const mockSolutionResponse: AIMessage = {
    ...mockAIResponse,
    content: {
      role: 'assistant',
      content: '',
      functionCall: {
        name: 'suggest_fix',
        arguments: JSON.stringify({
          description: 'Test solution',
          steps: ['Step 1', 'Step 2'],
          code: 'console.log("fix")',
          confidence: 0.8,
        }),
      },
    },
  };

  beforeEach(() => {
    session = new DebugSession(mockContext);
    mockAIService = AIService as jest.Mocked<typeof AIService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start debug session and analyze error', async () => {
      mockAIService.chat
        .mockResolvedValueOnce(mockAIResponse)
        .mockResolvedValueOnce(mockSolutionResponse);

      const startListener = jest.fn();
      const stepListener = jest.fn();
      const solutionsListener = jest.fn();

      session.on('start', startListener);
      session.on('step', stepListener);
      session.on('solutions', solutionsListener);

      await session.start();

      expect(startListener).toHaveBeenCalledWith(mockContext);
      expect(stepListener).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'initial_analysis',
          action: 'Analyze error',
          result: 'Test analysis',
          success: true,
        })
      );
      expect(solutionsListener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Test solution',
            steps: ['Step 1', 'Step 2'],
            code: 'console.log("fix")',
            confidence: 0.8,
          }),
        ])
      );
    });

    it('should handle start errors', async () => {
      const error = new Error('AI error');
      mockAIService.chat.mockRejectedValue(error);

      const errorListener = jest.fn();
      session.on('error', errorListener);

      await expect(session.start()).rejects.toThrow('AI error');
      expect(errorListener).toHaveBeenCalledWith(error);
    });

    it('should prevent multiple active sessions', async () => {
      mockAIService.chat
        .mockResolvedValueOnce(mockAIResponse)
        .mockResolvedValueOnce(mockSolutionResponse);

      await session.start();
      await expect(session.start()).rejects.toThrow('Debug session already active');
    });
  });

  describe('executeStep', () => {
    beforeEach(async () => {
      mockAIService.chat
        .mockResolvedValueOnce(mockAIResponse)
        .mockResolvedValueOnce(mockSolutionResponse);
      await session.start();
      jest.clearAllMocks();
    });

    it('should execute step successfully', async () => {
      mockAIService.chat.mockResolvedValue(mockAIResponse);

      const stepListener = jest.fn();
      session.on('step', stepListener);

      const step = await session.executeStep('Test step');

      expect(step).toEqual(
        expect.objectContaining({
          action: 'Test step',
          result: 'Test analysis',
          success: true,
        })
      );
      expect(stepListener).toHaveBeenCalledWith(step);
    });

    it('should handle step execution errors', async () => {
      const error = new Error('Step error');
      mockAIService.chat.mockRejectedValue(error);

      const stepListener = jest.fn();
      session.on('step', stepListener);

      await expect(session.executeStep('Test step')).rejects.toThrow('Step error');
      expect(stepListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Test step',
          result: 'Step error',
          success: false,
        })
      );
    });
  });

  describe('updateContext', () => {
    beforeEach(async () => {
      mockAIService.chat
        .mockResolvedValueOnce(mockAIResponse)
        .mockResolvedValueOnce(mockSolutionResponse);
      await session.start();
      jest.clearAllMocks();
    });

    it('should update context and reanalyze', async () => {
      mockAIService.chat
        .mockResolvedValueOnce(mockAIResponse)
        .mockResolvedValueOnce(mockSolutionResponse);

      const stepListener = jest.fn();
      const solutionsListener = jest.fn();

      session.on('step', stepListener);
      session.on('solutions', solutionsListener);

      await session.updateContext({
        environment: {
          os: 'test-os',
          runtime: 'test-runtime',
        },
      });

      expect(stepListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Update context',
          result: 'Test analysis',
          success: true,
        })
      );
      expect(solutionsListener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Test solution',
          }),
        ])
      );
    });
  });

  describe('end', () => {
    beforeEach(async () => {
      mockAIService.chat
        .mockResolvedValueOnce(mockAIResponse)
        .mockResolvedValueOnce(mockSolutionResponse);
      await session.start();
      jest.clearAllMocks();
    });

    it('should end session and emit results', async () => {
      const endListener = jest.fn();
      session.on('end', endListener);

      await session.end();

      expect(endListener).toHaveBeenCalledWith({
        steps: expect.arrayContaining([
          expect.objectContaining({
            id: 'initial_analysis',
          }),
        ]),
        solutions: expect.arrayContaining([
          expect.objectContaining({
            description: 'Test solution',
          }),
        ]),
      });
    });
  });
});
