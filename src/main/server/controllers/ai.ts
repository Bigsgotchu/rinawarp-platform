import { Router } from 'express';
import { AIService } from '../services/ai';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();
const aiService = new AIService();

/**
 * Get command suggestions
 */
router.get('/suggest', authenticate, async (req: AuthRequest, res) => {
  try {
    const { command, cwd } = req.query;

    if (!command || !cwd) {
      res.status(400).json({
        error: 'Command and current directory are required',
      });
      return;
    }

    const context = {
      previousCommands: [], // TODO: Get from history
      currentDirectory: cwd as string,
    };

    const suggestions = await aiService.suggestCommands(
      command as string,
      context
    );

    res.json({ suggestions });
  } catch (error) {
    logger.error('Failed to get suggestions:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
    });
  }
});

/**
 * Get command help
 */
router.get('/help', authenticate, async (req: AuthRequest, res) => {
  try {
    const { command } = req.query;

    if (!command) {
      res.status(400).json({
        error: 'Command is required',
      });
      return;
    }

    const context = {
      previousCommands: [], // TODO: Get from history
      currentDirectory: process.cwd(),
    };

    const help = await aiService.getCommandHelp(command as string, context);

    res.json({ help });
  } catch (error) {
    logger.error('Failed to get help:', error);
    res.status(500).json({
      error: 'Failed to get help',
    });
  }
});

/**
 * Get code completion
 */
router.post('/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const { code, language, file, cursor } = req.body;

    if (!code || !language || !cursor) {
      res.status(400).json({
        error: 'Code, language, and cursor position are required',
      });
      return;
    }

    const completion = await aiService.completeCode({
      code,
      language,
      file: file || 'untitled',
      cursor,
    });

    res.json({ completion });
  } catch (error) {
    logger.error('Failed to complete code:', error);
    res.status(500).json({
      error: 'Failed to complete code',
    });
  }
});

/**
 * Process natural language command
 */
router.post('/process', authenticate, async (req: AuthRequest, res) => {
  try {
    const { text, cwd } = req.body;

    if (!text || !cwd) {
      res.status(400).json({
        error: 'Text and current directory are required',
      });
      return;
    }

    const context = {
      previousCommands: [], // TODO: Get from history
      currentDirectory: cwd,
    };

    const result = await aiService.processNaturalLanguage(text, context);

    res.json({ result });
  } catch (error) {
    logger.error('Failed to process text:', error);
    res.status(500).json({
      error: 'Failed to process text',
    });
  }
});

/**
 * Explain command output
 */
router.post('/explain', authenticate, async (req: AuthRequest, res) => {
  try {
    const { command, output, error } = req.body;

    if (!command || !output) {
      res.status(400).json({
        error: 'Command and output are required',
      });
      return;
    }

    const explanation = await aiService.explainOutput(command, output, error);

    res.json({ explanation });
  } catch (error) {
    logger.error('Failed to explain output:', error);
    res.status(500).json({
      error: 'Failed to explain output',
    });
  }
});

/**
 * Get environment recommendations
 */
router.get('/recommendations', authenticate, async (req: AuthRequest, res) => {
  try {
    const context = {
      previousCommands: [], // TODO: Get from history
      currentDirectory: process.cwd(),
    };

    const recommendations =
      await aiService.getEnvironmentRecommendations(context);

    res.json({ recommendations });
  } catch (error) {
    logger.error('Failed to get recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
    });
  }
});

/**
 * Get error solutions
 */
router.post('/solutions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { error, cwd } = req.body;

    if (!error || !cwd) {
      res.status(400).json({
        error: 'Error message and current directory are required',
      });
      return;
    }

    const context = {
      previousCommands: [], // TODO: Get from history
      currentDirectory: cwd,
    };

    const solutions = await aiService.getSolutionSuggestions(error, context);

    res.json({ solutions });
  } catch (error) {
    logger.error('Failed to get solutions:', error);
    res.status(500).json({
      error: 'Failed to get solutions',
    });
  }
});

export default router;
