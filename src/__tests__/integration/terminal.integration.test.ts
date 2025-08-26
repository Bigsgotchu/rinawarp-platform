import request from 'supertest';
import { createServer } from '../../api/server';
import { PrismaClient } from '@prisma/client';
import { createTestUser, generateAuthToken } from '../helpers/auth';

describe('Terminal API Integration Tests', () => {
  let app: Express.Application;
  let prisma: PrismaClient;
  let authToken: string;

  beforeAll(async () => {
    app = await createServer();
    prisma = new PrismaClient();
    const user = await createTestUser(prisma);
    authToken = generateAuthToken(user);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/terminal/execute', () => {
    it('should execute a valid command', async () => {
      const response = await request(app)
        .post('/api/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'echo "test"',
          args: [],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('output');
      expect(response.body.output).toContain('test');
    });

    it('should return error for invalid command', async () => {
      const response = await request(app)
        .post('/api/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'invalid_command',
          args: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle command timeout', async () => {
      const response = await request(app)
        .post('/api/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'sleep 10',
          args: [],
        });

      expect(response.status).toBe(408);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/terminal/suggestions', () => {
    it('should return command suggestions', async () => {
      const response = await request(app)
        .post('/api/terminal/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          input: 'git',
          context: { currentDirectory: '/' },
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should handle empty input', async () => {
      const response = await request(app)
        .post('/api/terminal/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          input: '',
          context: { currentDirectory: '/' },
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
