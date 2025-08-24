import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Types of emails that can be unsubscribed from
export type EmailType = 'weekly' | 'monthly' | 'alerts' | 'marketing' | 'all';

interface UnsubscribePayload {
  userId: string;
  email: string;
  type: EmailType;
  timestamp: number;
}

export class UnsubscribeTokenService {
  private readonly secret: string;
  
  constructor() {
    // Use JWT_SECRET or generate a new one
    this.secret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate an unsubscribe token for a specific email type
   */
  generateToken(userId: string, email: string, type: EmailType): string {
    const payload: UnsubscribePayload = {
      userId,
      email,
      type,
      timestamp: Date.now()
    };

    return jwt.sign(payload, this.secret, { expiresIn: '1y' });
  }

  /**
   * Verify and decode an unsubscribe token
   */
  verifyToken(token: string): UnsubscribePayload {
    try {
      const decoded = jwt.verify(token, this.secret);
      if (typeof decoded === 'object' && decoded !== null) {
        return decoded as UnsubscribePayload;
      }
      throw new Error('Invalid token payload');
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Unsubscribe link has expired');
      }
      throw new Error('Invalid unsubscribe link');
    }
  }

  /**
   * Generate unsubscribe URL for email templates
   */
  generateUnsubscribeUrl(userId: string, email: string, type: EmailType): string {
    const token = this.generateToken(userId, email, type);
    const baseUrl = process.env.API_URL || 'https://api.rinawarptech.com';
    return `${baseUrl}/unsubscribe?token=${encodeURIComponent(token)}&type=${type}`;
  }

  /**
   * Generate a List-Unsubscribe header for emails
   */
  generateListUnsubscribeHeader(userId: string, email: string, type: EmailType): string {
    const unsubscribeUrl = this.generateUnsubscribeUrl(userId, email, type);
    const emailTo = `notifications@rinawarptech.com?subject=Unsubscribe&body=Please unsubscribe me from ${type} emails`;
    return `<${unsubscribeUrl}>, <mailto:${emailTo}>`;
  }
}

// Export singleton instance
export const unsubscribeTokenService = new UnsubscribeTokenService();
