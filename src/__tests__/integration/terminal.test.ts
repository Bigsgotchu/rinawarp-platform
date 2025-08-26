import { jest } from '@jest/globals';
import { Application } from 'express';
import request from 'supertest';
import { createServer } from '../../api/server';
import { db } from '../../lib/db';
import { redis } from '../../lib/redis';

jest.mock('../../lib/db');
jest.mock('../../lib/redis');

describe('Terminal Integration Tests', () => {
  let app: Application;
  let authToken: string;

  beforeAll(async () => {
    app = await createServer();

    // Create test user and get auth token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'test-password',
      });

    authToken = loginResponse.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Command Execution', () => {
    it('should execute basic shell command', async () => {
      const response = await request(app)
        .post('/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'echo "Hello World"',
        });

      expect(response.status).toBe(200);
      expect(response.body.output).toContain('Hello World');
    });

    it('should handle command with arguments', async () => {
      const response = await request(app)
        .post('/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'ls -la',
          cwd: '/tmp',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject unsafe commands', async () => {
      const response = await request(app)
        .post('/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'rm -rf /',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Unsafe command');
    });

    it('should respect user permissions', async () => {
      // Mock user without required permissions
      const response = await request(app)
        .post('/terminal/execute')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          command: 'echo "test"',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('AI Integration', () => {
    it('should process AI commands', async () => {
      const response = await request(app)
        .post('/terminal/ai')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'How do I list files in the current directory?',
        });

      expect(response.status).toBe(200);
      expect(response.body.response).toContain('ls');
    });

    it('should handle context-aware requests', async () => {
      // First command to set context
      await request(app)
        .post('/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'cd /tmp',
        });

      // AI request using context
      const response = await request(app)
        .post('/terminal/ai')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'What files are in this directory?',
        });

      expect(response.status).toBe(200);
      expect(response.body.response).toContain('ls');
      expect(response.body.context).toContain('/tmp');
    });

    it('should respect rate limits', async () => {
      // Mock rate limit exceeded
      const mockIncr = jest.spyOn(redis, 'incr');
      mockIncr.mockResolvedValue(1001); // Over limit

      const response = await request(app)
        .post('/terminal/ai')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'test prompt',
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Rate limit exceeded');
    });
  });

  describe('Command History', () => {
    it('should record command history', async () => {
      const mockLpush = jest.spyOn(redis, 'lpush');
      
      await request(app)
        .post('/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'echo "test"',
        });

      expect(mockLpush).toHaveBeenCalledWith(
        expect.stringContaining('command_history'),
        expect.any(String)
      );
    });

    it('should retrieve command history', async () => {
      const mockLrange = jest.spyOn(redis, 'lrange');
      mockLrange.mockResolvedValue([
        JSON.stringify({ command: 'echo "test"', timestamp: Date.now() }),
      ]);

      const response = await request(app)
        .get('/terminal/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(1);
      expect(response.body.history[0].command).toBe('echo "test"');
    });
  });

  describe('Command Completion', () => {
    it('should provide command suggestions', async () => {
      const response = await request(app)
        .post('/terminal/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'git',
          position: 3,
        });

      expect(response.status).toBe(200);
      expect(response.body.suggestions).toEqual(
        expect.arrayContaining(['add', 'commit', 'push', 'pull'])
      );
    });

    it('should provide context-aware suggestions', async () => {
      // First set up git context
      await request(app)
        .post('/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'git init',
        });

      const response = await request(app)
        .post('/terminal/complete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'git add ',
          position: 8,
        });

      expect(response.status).toBe(200);
      expect(response.body.suggestions).toEqual(
        expect.arrayContaining(['.', '*', '--all'])
      );
    });
  });

  describe('Terminal Sessions', () => {
    it('should create and maintain session state', async () => {
      // Start session
      const sessionResponse = await request(app)
        .post('/terminal/session')
        .set('Authorization', `Bearer ${authToken}`);

      expect(sessionResponse.status).toBe(200);
      const { sessionId } = sessionResponse.body;

      // Execute command in session
      const execResponse = await request(app)
        .post('/terminal/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          command: 'cd /tmp',
          sessionId,
        });

      expect(execResponse.status).toBe(200);

      // Verify session state
      const stateResponse = await request(app)
        .get(`/terminal/session/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(stateResponse.status).toBe(200);
      expect(stateResponse.body.cwd).toBe('/tmp');
    });

    it('should handle session cleanup', async () => {
      // Start session
      const sessionResponse = await request(app)
        .post('/terminal/session')
        .set('Authorization', `Bearer ${authToken}`);

      const { sessionId } = sessionResponse.body;

      // End session
      const endResponse = await request(app)
        .delete(`/terminal/session/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(endResponse.status).toBe(200);

      // Verify session is cleaned up
      const stateResponse = await request(app)
        .get(`/terminal/session/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(stateResponse.status).toBe(404);
    });
  });
});
