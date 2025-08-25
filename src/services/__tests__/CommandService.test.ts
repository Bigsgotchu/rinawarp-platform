import { CommandService } from '../CommandService';
import { Command } from '../../types';

describe('CommandService', () => {
  let commandService: CommandService;

  beforeEach(() => {
    commandService = new CommandService();
  });

  describe('executeCommand', () => {
    it('should execute a simple command successfully', async () => {
      const command: Command = {
        command: 'echo',
        args: ['hello', 'world'],
      };

      const result = await commandService.executeCommand(command);
      expect(result.output).toBe('hello world\n');
      expect(result.exitCode).toBe(0);
    });

    it('should handle command errors', async () => {
      const command: Command = {
        command: 'nonexistentcommand',
      };

      const result = await commandService.executeCommand(command);
      expect(result.exitCode).not.toBe(0);
      expect(result.error).toBeDefined();
    });

    it('should respect working directory', async () => {
      const command: Command = {
        command: 'pwd',
        cwd: '/tmp',
      };

      const result = await commandService.executeCommand(command);
      expect(result.output.trim()).toMatch(/\/tmp$/);
      expect(result.exitCode).toBe(0);
    });
  });
});
