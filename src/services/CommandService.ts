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
      return {
        output: error.stderr,
        exitCode: error.code || 1,
        error: error.message,
      };
    }
  }
}

export default new CommandService();
