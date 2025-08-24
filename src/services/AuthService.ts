import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  UserRole,
  UserStatus,
  SubscriptionPlan,
  AuthTokens,
  LoginCredentials,
  RegistrationData,
  AuthPayload,
  RefreshTokenPayload,
  UserSession,
  PasswordResetToken
} from '../types/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { sendEmail } from '../utils/email';
import redis from '../utils/redis';
import db from '../utils/db';
import StripeService from './StripeService';

class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
  private readonly JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';
  private readonly REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || '7d';
  private readonly SALT_ROUNDS = 12;

  async register(data: RegistrationData): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser) {
        throw new AppError('Email already registered', 'DUPLICATE_EMAIL', 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, this.SALT_ROUNDS);

      // Create Stripe customer
      const stripeCustomer = await StripeService.createCustomer({
        email: data.email,
        name: data.name
      });

      // Create user
      const user = await db.user.create({
        data: {
          id: uuidv4(),
          email: data.email,
          name: data.name,
          hashedPassword,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          stripeCustomerId: stripeCustomer.id,
          currentPlan: SubscriptionPlan.FREE,
          preferences: {
            emailNotifications: true,
            theme: 'light',
            commandSuggestions: true,
            aiAssistance: true
          }
        }
      });

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Send welcome email
      await this.sendWelcomeEmail(user);

      return { user, tokens };
    } catch (error) {
      logger.error('Registration failed:', error);
      throw error;
    }
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      // Find user
      const user = await db.user.findUnique({
        where: { email: credentials.email }
      });

      if (!user) {
        throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // Check password
      const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
      if (!isValid) {
        throw new AppError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
      }

      // Check user status
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError('Account is not active', 'INACTIVE_ACCOUNT', 403);
      }

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Update last login
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      return { user, tokens };
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(
        refreshToken,
        this.REFRESH_TOKEN_SECRET
      ) as RefreshTokenPayload;

      // Check if token is blacklisted
      const isBlacklisted = await redis.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new AppError('Token is invalid', 'INVALID_TOKEN', 401);
      }

      // Get user
      const user = await db.user.findUnique({
        where: { id: payload.userId }
      });

      if (!user) {
        throw new AppError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new AppError('Invalid refresh token', 'INVALID_TOKEN', 401);
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      // Blacklist refresh token
      await redis.set(
        `blacklist:${refreshToken}`,
        '1',
        'EX',
        60 * 60 * 24 * 7 // 7 days
      );

      // Clear user sessions
      await this.clearUserSessions(userId);
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Don't reveal if email exists
        return;
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      // Save reset token
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt
        }
      });

      // Send reset email
      await this.sendPasswordResetEmail(user, token);
    } catch (error) {
      logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    try {
      // Find valid token
      const resetToken = await db.passwordResetToken.findFirst({
        where: {
          token,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (!resetToken) {
        throw new AppError('Invalid or expired token', 'INVALID_TOKEN', 400);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update password
      await db.user.update({
        where: { id: resetToken.userId },
        data: { hashedPassword }
      });

      // Delete used token
      await db.passwordResetToken.delete({
        where: { token }
      });
    } catch (error) {
      logger.error('Password reset confirmation failed:', error);
      throw error;
    }
  }

  async createSession(user: User, req: any): Promise<UserSession> {
    try {
      const session = await db.userSession.create({
        data: {
          id: uuidv4(),
          userId: user.id,
          deviceInfo: {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            device: this.getDeviceInfo(req),
            location: await this.getLocationInfo(req.ip)
          },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      return session;
    } catch (error) {
      logger.error('Session creation failed:', error);
      throw error;
    }
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.currentPlan || SubscriptionPlan.FREE
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRATION
    });

    const refreshToken = jwt.sign(
      { userId: user.id, tokenVersion: uuidv4() },
      this.REFRESH_TOKEN_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRATION }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(this.JWT_EXPIRATION) || 86400 // 24 hours in seconds
    };
  }

  private async clearUserSessions(userId: string): Promise<void> {
    await db.userSession.deleteMany({
      where: { userId }
    });
  }

  private async sendWelcomeEmail(user: User): Promise<void> {
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Rinawarp!',
      template: 'welcome',
      data: {
        name: user.name
      }
    });
  }

  private async sendPasswordResetEmail(user: User, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Reset your password',
      template: 'password-reset',
      data: {
        name: user.name,
        resetUrl
      }
    });
  }

  private getDeviceInfo(req: any): string {
    // TODO: Implement proper device detection
    return req.headers['user-agent'] || 'unknown';
  }

  private async getLocationInfo(ip: string): Promise<string | undefined> {
    // TODO: Implement IP geolocation
    return undefined;
  }
}

export default new AuthService();
