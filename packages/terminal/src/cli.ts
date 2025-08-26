#!/usr/bin/env node

const { Command } = require('commander');
const { TerminalService } = require('./service');
const { logger } = require('@rinawarp/shared');

const program = new Command();

program
  .name('rinawarp')
  .description('AI-Powered Terminal for Enhanced Productivity')
  .version('1.0.0');

program
  .command('start')
  .description('Start an interactive terminal session')
  .option('-d, --dir <directory>', 'Working directory')
  .option('-r, --rows <rows>', 'Terminal rows', '24')
  .option('-c, --cols <cols>', 'Terminal columns', '80')
  .action(async (options) => {
    try {
      const terminal = TerminalService.getInstance();
      const config = {
        cwd: options.dir || process.cwd(),
        rows: parseInt(options.rows, 10),
        cols: parseInt(options.cols, 10),
      };

      terminal.start(config);
      logger.info(`Terminal started in ${config.cwd}`);

      // Handle terminal data
      terminal.on('data', (data) => {
        process.stdout.write(data);
      });

      // Handle terminal exit
      terminal.on('exit', (code) => {
        logger.info(`Terminal exited with code ${code}`);
        process.exit(code);
      });

      // Handle input
      process.stdin.setRawMode(true);
      process.stdin.on('data', (data) => {
        terminal['ptyProcess']?.write(data.toString());
      });
    } catch (error) {
      logger.error('Failed to start terminal:', error);
      process.exit(1);
    }
  });

program
  .command('exec')
  .description('Execute a command with AI assistance')
  .argument('<command>', 'Command to execute')
  .option('-d, --dir <directory>', 'Working directory')
  .action(async (command, options) => {
    try {
      const terminal = TerminalService.getInstance();
      const result = await terminal.executeCommand({
        command,
        cwd: options.dir || process.cwd(),
      });

      if (result.error) {
        console.error(result.error);
        process.exit(result.exitCode || 1);
      }

      console.log(result.output);
      process.exit(result.exitCode);
    } catch (error) {
      logger.error('Failed to execute command:', error);
      process.exit(1);
    }
  });

program.parse();
