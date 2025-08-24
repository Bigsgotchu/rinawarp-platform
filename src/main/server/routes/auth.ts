import { Router } from 'express';
import { AuthService } from '../services/auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../../utils/logger';

const router = Router();
const authService = new AuthService();

/**
 * Register new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({
        error: 'Email, password, and name are required'
      });
      return;
    }

    // Register user
    const { user, token } = await authService.register(
      email,
      password,
      name
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    logger.error('Registration failed:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
});

/**
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        error: 'Email and password are required'
      });
      return;
    }

    // Login user
    const { user, token } = await authService.login(email, password);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Login failed'
    });
  }
});

/**
 * Logout user
 */
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await authService.logout(token);
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout failed:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

/**
 * Get current user
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        error: 'Not authenticated'
      });
      return;
    }

    res.json({ user });
  } catch (error) {
    logger.error('Failed to get current user:', error);
    res.status(500).json({
      error: 'Failed to get current user'
    });
  }
});

/**
 * Update user
 */
router.patch('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        error: 'Not authenticated'
      });
      return;
    }

    const { name, email, password } = req.body;
    const updates: {
      name?: string;
      email?: string;
      password?: string;
    } = {};

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (password) updates.password = password;

    const updatedUser = await authService.updateUser(user.id, updates);

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to update user'
    });
  }
});

/**
 * Delete user
 */
router.delete('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        error: 'Not authenticated'
      });
      return;
    }

    await authService.deleteUser(user.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    res.status(500).json({
      error: 'Failed to delete user'
    });
  }
});

/**
 * Request password reset
 */
router.post('/reset-password/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        error: 'Email is required'
      });
      return;
    }

    const token = await authService.createPasswordResetToken(email);

    // TODO: Send reset email with token
    // For now, just return the token
    res.json({ token });
  } catch (error) {
    logger.error('Failed to request password reset:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to request password reset'
    });
  }
});

/**
 * Reset password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({
        error: 'Token and new password are required'
      });
      return;
    }

    await authService.resetPassword(token, newPassword);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to reset password:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to reset password'
    });
  }
});

export default router;
