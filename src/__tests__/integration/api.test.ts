import { jest } from '@jest/globals';
import { Application } from 'express';
import request from 'supertest';
import { createServer } from '../../api/server';
import { db } from '../../lib/db';

jest.mock('../../lib/db');

describe('API Integration Tests', () => {
  let app: Application;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createServer();

    // Get admin token
    const adminLogin = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin-password',
      });
    adminToken = adminLogin.body.token;

    // Get user token
    const userLogin = await request(app)
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'user-password',
      });
    userToken = userLogin.body.token;
  });

  describe('Authentication API', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'Test123!',
          name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
      });
    });

    it('should handle login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'user@example.com',
          password: 'user-password',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should handle invalid login credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'user@example.com',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should refresh access token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({
          refreshToken: 'valid-refresh-token',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should handle logout', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('User API', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        email: 'user@example.com',
        name: expect.any(String),
      });
    });

    it('should update user profile', async () => {
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('should handle password change', async () => {
      const response = await request(app)
        .put('/users/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'user-password',
          newPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Subscription API', () => {
    it('should get subscription status', async () => {
      const response = await request(app)
        .get('/subscription/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('plan');
      expect(response.body).toHaveProperty('status');
    });

    it('should handle subscription update', async () => {
      const response = await request(app)
        .post('/subscription/update')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          plan: 'pro',
          interval: 'monthly',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
    });

    it('should handle subscription cancellation', async () => {
      const response = await request(app)
        .post('/subscription/cancel')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Analytics API', () => {
    it('should get user usage analytics', async () => {
      const response = await request(app)
        .get('/analytics/usage')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('commandCount');
      expect(response.body).toHaveProperty('aiRequests');
    });

    it('should get system analytics as admin', async () => {
      const response = await request(app)
        .get('/analytics/system')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('activeSubscriptions');
    });

    it('should deny system analytics to regular users', async () => {
      const response = await request(app)
        .get('/analytics/system')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Health API', () => {
    it('should check system health', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
    });

    it('should check detailed health as admin', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('metrics');
    });
  });

  describe('Admin API', () => {
    it('should list users as admin', async () => {
      const response = await request(app)
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeInstanceOf(Array);
    });

    it('should get system metrics as admin', async () => {
      const response = await request(app)
        .get('/admin/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('requests');
    });

    it('should manage user roles as admin', async () => {
      const response = await request(app)
        .put('/admin/users/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'test-user-id',
          role: 'admin',
        });

      expect(response.status).toBe(200);
      expect(response.body.role).toBe('admin');
    });
  });

  describe('Error Handling', () => {
    it('should handle not found errors', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // Too short
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});
