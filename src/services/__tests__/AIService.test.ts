import AIService from '../AIService';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'SAFE: Simple listing command\nAlternative commands: ls -la, ls --all'
            }
          }]
        })
      }
    }
  }));
});

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCommand', () => {
    it('should analyze a command and return suggestions', async () => {
      const result = await AIService.analyzeCommand({ command: 'ls', args: ['-l'] });
      
      expect(result.suggestion).toBeDefined();
      expect(result.alternatives).toEqual(['ls -la', 'ls --all']);
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      const openai = require('openai');
      openai.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }));

      const result = await AIService.analyzeCommand({ command: 'ls' });
      
      expect(result.suggestion).toBe('Unable to analyze command at this time.');
      expect(result.alternatives).toEqual([]);
    });
  });

  describe('validateCommandSafety', () => {
    it('should validate safe commands', async () => {
      const result = await AIService.validateCommandSafety({ command: 'ls', args: ['-l'] });
      expect(result).toBe(true);
    });

    it('should validate unsafe commands', async () => {
      // Mock unsafe response
      const openai = require('openai');
      openai.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'UNSAFE: This command could be dangerous'
                }
              }]
            })
          }
        }
      }));

      const result = await AIService.validateCommandSafety({ command: 'rm', args: ['-rf', '/'] });
      expect(result).toBe(false);
    });
  });
});
