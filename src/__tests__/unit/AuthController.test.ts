import AuthController from '../AuthController';
import {
  setupTestEnv,
  teardownTestEnv,
  createTestRequest,
  createTestResponse,
  createTestUser,
  prisma,
} from '../../test/setup';
import { hashSync } from 'bcryptjs';

describe('AuthController', () => {
  beforeAll(async () => {
    await setupTestEnv();
  });

  afterAll(async () => {
    await teardownTestEnv();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      const req = createTestRequest({
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        },
      });
      const res = createTestResponse();

      await AuthController.register(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'test@example.com',
            name: 'Test User',
          }),
          token: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it('should return error for existing email', async () => {
      await createTestUser();

      const req = createTestRequest({
        body: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        },
      });
      const res = createTestResponse();

      await AuthController.register(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Email already registered',
        })
      );
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          hashedPassword: hashSync('password123', 10),
          name: 'Test User',
          role: 'USER',
        },
      });
    });

    it('should login user and return tokens', async () => {
      const req = createTestRequest({
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      });
      const res = createTestResponse();

      await AuthController.login(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'test@example.com',
          }),
          token: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it('should return error for invalid credentials', async () => {
      const req = createTestRequest({
        body: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });
      const res = createTestResponse();

      await AuthController.login(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid credentials',
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token with valid refresh token', async () => {
      const { user, token: refreshToken } = await createTestUser();

      const req = createTestRequest({
        body: {
          refreshToken,
        },
      });
      const res = createTestResponse();

      await AuthController.refreshToken(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String),
        })
      );
    });

    it('should return error for invalid refresh token', async () => {
      const req = createTestRequest({
        body: {
          refreshToken: 'invalid-token',
        },
      });
      const res = createTestResponse();

      await AuthController.refreshToken(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid refresh token',
        })
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const { user, token } = await createTestUser();

      const req = createTestRequest({
        user,
        body: {
          refreshToken: token,
        },
      });
      const res = createTestResponse();

      await AuthController.logout(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});
