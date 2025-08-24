import { sign, verify } from 'jsonwebtoken';
import { hash, compare } from 'bcrypt';
import { db } from '../database';
import { logger } from '../../utils/logger';
import { CacheService } from './cache';
import { config } from '../../config';

export interface User {
  id: string;
  email: string;
  name: string;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export class AuthService {
  private cache: CacheService;
  private readonly saltRounds = 12;
  private readonly sessionPrefix = 'session:';
  private readonly userPrefix = 'user:';

  constructor() {
    this.cache = new CacheService();
  }

  /**
   * Register new user
   */
  public async register(
    email: string,
    password: string,
    name: string
  ): Promise<{ user: User; token: string }> {
    try {
      // Check if user exists
      const existing = await db.users.findOne({ email });
      if (existing) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await hash(password, this.saltRounds);

      // Create user
      const user = await db.users.create({
        email,
        name,
        passwordHash,
      });

      // Create session
      const { token } = await this.createSession(user.id);

      // Cache user
      await this.cache.set(
        `${this.userPrefix}${user.id}`,
        user,
        24 * 3600 // 24 hours
      );

      return { user, token };
    } catch (error) {
      logger.error('Failed to register user:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  public async login(
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> {
    try {
      // Get user
      const user = await db.users.findOne({ email });
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const valid = await compare(password, user.passwordHash);
      if (!valid) {
        throw new Error('Invalid email or password');
      }

      // Create session
      const { token } = await this.createSession(user.id);

      // Cache user
      await this.cache.set(
        `${this.userPrefix}${user.id}`,
        user,
        24 * 3600 // 24 hours
      );

      return { user, token };
    } catch (error) {
      logger.error('Failed to login user:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  public async logout(token: string): Promise<void> {
    try {
      // Get session
      const session = await this.getSession(token);
      if (!session) {
        return;
      }

      // Delete session
      await db.sessions.delete({ id: session.id });

      // Remove from cache
      await this.cache.mdelete([
        `${this.sessionPrefix}${token}`,
        `${this.userPrefix}${session.userId}`,
      ]);
    } catch (error) {
      logger.error('Failed to logout user:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  public async getCurrentUser(token: string): Promise<User | null> {
    try {
      // Get session
      const session = await this.getSession(token);
      if (!session) {
        return null;
      }

      // Get user from cache
      const cacheKey = `${this.userPrefix}${session.userId}`;
      const cachedUser = await this.cache.get<User>(cacheKey);
      if (cachedUser) {
        return cachedUser;
      }

      // Get user from database
      const user = await db.users.findOne({ id: session.userId });
      if (!user) {
        return null;
      }

      // Cache user
      await this.cache.set(cacheKey, user, 24 * 3600); // 24 hours

      return user;
    } catch (error) {
      logger.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Create session
   */
  private async createSession(userId: string): Promise<Session> {
    try {
      // Generate JWT
      const token = sign({ userId }, config.auth.jwtSecret, {
        expiresIn: config.auth.jwtExpiration,
      });

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setHours(
        expiresAt.getHours() + parseInt(config.auth.jwtExpiration)
      );

      // Create session
      const session = await db.sessions.create({
        userId,
        token,
        expiresAt,
      });

      // Cache session
      await this.cache.set(
        `${this.sessionPrefix}${token}`,
        session,
        24 * 3600 // 24 hours
      );

      return session;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Get session
   */
  private async getSession(token: string): Promise<Session | null> {
    try {
      // Verify JWT
      const payload = verify(token, config.auth.jwtSecret) as { userId: string };
      if (!payload?.userId) {
        return null;
      }

      // Get session from cache
      const cacheKey = `${this.sessionPrefix}${token}`;
      const cachedSession = await this.cache.get<Session>(cacheKey);
      if (cachedSession) {
        return cachedSession;
      }

      // Get session from database
      const session = await db.sessions.findOne({
        token,
        userId: payload.userId,
      });

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        await db.sessions.delete({ id: session.id });
        return null;
      }

      // Cache session
      await this.cache.set(cacheKey, session, 24 * 3600); // 24 hours

      return session;
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Update user
   */
  public async updateUser(
    userId: string,
    updates: {
      name?: string;
      email?: string;
      password?: string;
    }
  ): Promise<User> {
    try {
      const updateData: any = { ...updates };

      // Hash new password if provided
      if (updates.password) {
        updateData.passwordHash = await hash(updates.password, this.saltRounds);
        delete updateData.password;
      }

      // Update user
      const user = await db.users.update(userId, updateData);

      // Invalidate cache
      await this.cache.delete(`${this.userPrefix}${userId}`);

      return user;
    } catch (error) {
      logger.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  public async deleteUser(userId: string): Promise<void> {
    try {
      // Delete user's sessions
      await db.sessions.deleteMany({ userId });

      // Delete user
      await db.users.delete({ id: userId });

      // Invalidate cache
      await this.cache.mdelete([
        `${this.userPrefix}${userId}`,
        `${this.sessionPrefix}*`,
      ]);
    } catch (error) {
      logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  public async resetPassword(
    token: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Verify reset token
      const payload = verify(token, config.auth.jwtSecret) as {
        userId: string;
        type: string;
      };

      if (!payload?.userId || payload.type !== 'password_reset') {
        throw new Error('Invalid reset token');
      }

      // Hash new password
      const passwordHash = await hash(newPassword, this.saltRounds);

      // Update user
      await db.users.update(payload.userId, { passwordHash });

      // Invalidate sessions
      await db.sessions.deleteMany({ userId: payload.userId });

      // Invalidate cache
      await this.cache.mdelete([
        `${this.userPrefix}${payload.userId}`,
        `${this.sessionPrefix}*`,
      ]);
    } catch (error) {
      logger.error('Failed to reset password:', error);
      throw error;
    }
  }

  /**
   * Create password reset token
   */
  public async createPasswordResetToken(email: string): Promise<string> {
    try {
      // Get user
      const user = await db.users.findOne({ email });
      if (!user) {
        throw new Error('User not found');
      }

      // Generate reset token
      const token = sign(
        { userId: user.id, type: 'password_reset' },
        config.auth.jwtSecret,
        { expiresIn: '1h' }
      );

      return token;
    } catch (error) {
      logger.error('Failed to create reset token:', error);
      throw error;
    }
  }
}
