import UnsubscribeTokenService from '../../services/UnsubscribeTokenService';
import config from '../../config';

describe('UnsubscribeTokenService', () => {
  const userId = 'test-user-123';
  const validTypes = ['daily', 'weekly', 'monthly'];

  beforeEach(() => {
    // Reset config before each test
    config.security.unsubscribeSecret = 'test-secret';
    config.appUrl = 'http://test.com';
  });

  describe('generateToken', () => {
    it('generates valid tokens for all report types', () => {
      validTypes.forEach(type => {
        const token = UnsubscribeTokenService.generateToken(userId, type);
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
      });
    });

    it('throws error for invalid report type', () => {
      expect(() => {
        UnsubscribeTokenService.generateToken(userId, 'invalid-type');
      }).toThrow('Invalid report type');
    });

    it('generates unique tokens for different users', () => {
      const token1 = UnsubscribeTokenService.generateToken('user1', 'daily');
      const token2 = UnsubscribeTokenService.generateToken('user2', 'daily');
      expect(token1).not.toBe(token2);
    });

    it('generates unique tokens for different report types', () => {
      const token1 = UnsubscribeTokenService.generateToken(userId, 'daily');
      const token2 = UnsubscribeTokenService.generateToken(userId, 'weekly');
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('verifies valid tokens correctly', () => {
      validTypes.forEach(type => {
        const token = UnsubscribeTokenService.generateToken(userId, type);
        const isValid = UnsubscribeTokenService.verifyToken(
          token,
          userId,
          type
        );
        expect(isValid).toBe(true);
      });
    });

    it('rejects tokens with wrong user ID', () => {
      const token = UnsubscribeTokenService.generateToken(userId, 'daily');
      const isValid = UnsubscribeTokenService.verifyToken(
        token,
        'wrong-user',
        'daily'
      );
      expect(isValid).toBe(false);
    });

    it('rejects tokens with wrong report type', () => {
      const token = UnsubscribeTokenService.generateToken(userId, 'daily');
      const isValid = UnsubscribeTokenService.verifyToken(
        token,
        userId,
        'weekly'
      );
      expect(isValid).toBe(false);
    });

    it('rejects tampered tokens', () => {
      const token = UnsubscribeTokenService.generateToken(userId, 'daily');
      const tamperedToken = token.slice(0, -1) + 'X'; // Change last character
      const isValid = UnsubscribeTokenService.verifyToken(
        tamperedToken,
        userId,
        'daily'
      );
      expect(isValid).toBe(false);
    });

    it('rejects malformed tokens', () => {
      const isValid = UnsubscribeTokenService.verifyToken(
        'invalid-token',
        userId,
        'daily'
      );
      expect(isValid).toBe(false);
    });

    it('rejects expired tokens', () => {
      // Mock Date.now() to return a fixed timestamp
      const realDateNow = Date.now;
      const fixedTime = 1629504000000; // Some fixed timestamp
      Date.now = jest.fn(() => fixedTime);

      // Generate token
      const token = UnsubscribeTokenService.generateToken(userId, 'daily');

      // Move time forward 31 days
      Date.now = jest.fn(() => fixedTime + 31 * 24 * 60 * 60 * 1000);

      const isValid = UnsubscribeTokenService.verifyToken(
        token,
        userId,
        'daily'
      );
      expect(isValid).toBe(false);

      // Restore original Date.now
      Date.now = realDateNow;
    });
  });

  describe('generateUnsubscribeUrl', () => {
    it('generates valid unsubscribe URLs', () => {
      validTypes.forEach(type => {
        const url = UnsubscribeTokenService.generateUnsubscribeUrl(
          userId,
          type
        );
        expect(url).toMatch(
          new RegExp(`^${config.appUrl}/api/analytics/unsubscribe`)
        );
        expect(url).toContain(`userId=${userId}`);
        expect(url).toContain(`type=${type}`);
        expect(url).toContain('token=');
      });
    });

    it('generates URLs with valid tokens', () => {
      validTypes.forEach(type => {
        const url = UnsubscribeTokenService.generateUnsubscribeUrl(
          userId,
          type
        );
        const token = new URLSearchParams(url.split('?')[1]).get('token');
        expect(token).toBeDefined();
        expect(UnsubscribeTokenService.verifyToken(token!, userId, type)).toBe(
          true
        );
      });
    });
  });
});
