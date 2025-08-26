import { exec } from 'child_process';
import { promisify } from 'util';
import { Command, CommandResult } from '../types';
import logger from '../utils/logger';

const execAsync = promisify(exec);

export class CommandService {
  async executeCommand(command: Command): Promise<CommandResult> {
    try {
      const options = {
        cwd: command.cwd || process.cwd(),
      };

      const fullCommand = command.args
        ? `${command.command} ${command.args.join(' ')}`
        : command.command;

      logger.info(`Executing command: ${fullCommand}`);

      const { stdout, stderr } = await execAsync(fullCommand, options);

      return {
        output: stdout || stderr,
        exitCode: 0,
      };
    } catch (error) {
      logger.error('Command execution failed:', error);
      if (error instanceof Error) {
        const cmdError = error as any;
        return {
          output: cmdError.stderr || '',
          exitCode: cmdError.code || 1,
          error: cmdError.message,
        };
      }
      return {
        output: '',
        exitCode: 1,
        error: 'Unknown error occurred',
      };
    }
  }
}

export default new CommandService();
