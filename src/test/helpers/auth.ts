import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole, SubscriptionPlan } from '../../types/auth';

const prisma = new PrismaClient();

export async function createTestUser(overrides = {}) {
  const defaultUser = {
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    status: 'active',
    currentPlan: SubscriptionPlan.FREE,
    hashedPassword: hashSync('testpassword123', 10),
    ...overrides
  };

  const user = await prisma.user.create({
    data: defaultUser
  });

  const token = generateAuthToken(user);

  return { user, token };
}

export function generateAuthToken(user: any) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.currentPlan
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}
