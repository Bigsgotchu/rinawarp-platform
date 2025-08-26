import { createHmac } from 'crypto';
import config from '../config';
import logger from '../utils/logger';

class UnsubscribeTokenService {
  private static readonly TOKEN_SEPARATOR = '.';
  private static readonly TOKEN_VERSION = '1';
  private static readonly VALID_REPORT_TYPES = ['daily', 'weekly', 'monthly'];

  /**
   * Generate an unsubscribe token for a specific user and report type
   */
  static generateToken(userId: string, reportType: string): string {
    try {
      if (!this.VALID_REPORT_TYPES.includes(reportType)) {
        throw new Error(`Invalid report type: ${reportType}`);
      }

      // Create token payload
      const timestamp = Date.now();
      const payload = `${this.TOKEN_VERSION}${this.TOKEN_SEPARATOR}${userId}${this.TOKEN_SEPARATOR}${reportType}${this.TOKEN_SEPARATOR}${timestamp}`;

      // Generate HMAC
      const hmac = createHmac('sha256', config.security.unsubscribeSecret)
        .update(payload)
        .digest('hex');

      // Combine payload and HMAC
      return Buffer.from(`${payload}${this.TOKEN_SEPARATOR}${hmac}`).toString(
        'base64'
      );
    } catch (error) {
      logger.error('Failed to generate unsubscribe token:', error);
      throw error;
    }
  }

  /**
   * Verify an unsubscribe token
   */
  static verifyToken(
    token: string,
    userId: string,
    reportType: string
  ): boolean {
    try {
      // Decode token
      const decodedToken = Buffer.from(token, 'base64').toString();
      const [version, tokenUserId, tokenReportType, timestamp, hmac] =
        decodedToken.split(this.TOKEN_SEPARATOR);

      // Validate token format
      if (!version || !tokenUserId || !tokenReportType || !timestamp || !hmac) {
        logger.warn('Invalid token format');
        return false;
      }

      // Validate token version
      if (version !== this.TOKEN_VERSION) {
        logger.warn('Invalid token version');
        return false;
      }

      // Validate user ID and report type
      if (tokenUserId !== userId || tokenReportType !== reportType) {
        logger.warn('Token mismatch');
        return false;
      }

      // Check token age (max 30 days)
      const tokenAge = Date.now() - parseInt(timestamp);
      if (tokenAge > 30 * 24 * 60 * 60 * 1000) {
        logger.warn('Token expired');
        return false;
      }

      // Verify HMAC
      const payload = `${version}${this.TOKEN_SEPARATOR}${tokenUserId}${this.TOKEN_SEPARATOR}${tokenReportType}${this.TOKEN_SEPARATOR}${timestamp}`;
      const expectedHmac = createHmac(
        'sha256',
        config.security.unsubscribeSecret
      )
        .update(payload)
        .digest('hex');

      return hmac === expectedHmac;
    } catch (error) {
      logger.error('Failed to verify unsubscribe token:', error);
      return false;
    }
  }

  /**
   * Generate an unsubscribe URL for a specific user and report type
   */
  static generateUnsubscribeUrl(userId: string, reportType: string): string {
    const token = this.generateToken(userId, reportType);
    const params = new URLSearchParams({
      userId,
      type: reportType,
      token,
    });

    return `${config.appUrl}/api/analytics/unsubscribe?${params.toString()}`;
  }
}

export default UnsubscribeTokenService;
