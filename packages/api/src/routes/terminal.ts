import { Router } from 'express';
import { TerminalService } from '@rinawarp/terminal';
import { logger } from '@rinawarp/shared';

const router = Router();
const terminal = TerminalService.getInstance();

// Initialize a new terminal session
router.post('/session', async (req, res) => {
  try {
    const { cwd, rows, cols } = req.body;
    
    terminal.start({
      cwd,
      rows: rows || 24,
      cols: cols || 80,
    });

    res.json({
      pid: terminal.processId,
      cwd: terminal.currentDirectory,
      shell: terminal.currentShell,
    });
  } catch (error) {
    logger.error('Failed to start terminal session:', error);
    res.status(500).json({
      error: 'Failed to start terminal session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Execute a command
router.post('/exec', async (req, res) => {
  try {
    const { command, cwd, timeout } = req.body;

    const result = await terminal.executeCommand({
      command,
      cwd: cwd || terminal.currentDirectory,
      timeout,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to execute command:', error);
    res.status(500).json({
      error: 'Failed to execute command',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Get command suggestions
router.post('/suggest', async (req, res) => {
  try {
    const { command } = req.body;
    const suggestions = await terminal.getSuggestions(command);
    res.json({ suggestions });
  } catch (error) {
    logger.error('Failed to get command suggestions:', error);
    res.status(500).json({
      error: 'Failed to get command suggestions',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Resize terminal
router.post('/resize', (req, res) => {
  try {
    const { rows, cols } = req.body;
    terminal.resize(rows, cols);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to resize terminal:', error);
    res.status(500).json({
      error: 'Failed to resize terminal',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
