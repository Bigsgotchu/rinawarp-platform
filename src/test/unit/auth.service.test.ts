import { AuthService } from '../../auth/services/auth';
import { PrismaClient } from '@prisma/client';
import { mockDeep, MockProxy } from 'jest-mock-extended';

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: MockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    authService = new AuthService(prisma);
  });

  describe('login', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        name: 'Test User'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'correctPassword'
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error with invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'wrongPassword'
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    it('should generate new access token with valid refresh token', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com'
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.refreshToken('validRefreshToken');

      expect(result).toHaveProperty('accessToken');
    });

    it('should throw error with invalid refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshToken('invalidRefreshToken')
      ).rejects.toThrow('Invalid refresh token');
    });
  });
});
