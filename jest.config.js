/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'core-api',
      testMatch: [
        '<rootDir>/src/routes/__tests__/auth.test.ts',
        '<rootDir>/src/routes/__tests__/billing.test.ts',
        '<rootDir>/src/routes/__tests__/subscription.test.ts',
        '<rootDir>/src/controllers/__tests__/AuthController.test.ts',
        '<rootDir>/src/controllers/__tests__/BillingController.test.ts',
        '<rootDir>/src/controllers/__tests__/SubscriptionController.test.ts',
        '<rootDir>/src/services/__tests__/AuthService.test.ts',
        '<rootDir>/src/services/__tests__/BillingService.test.ts',
        '<rootDir>/src/services/__tests__/SubscriptionService.test.ts',
        '<rootDir>/src/services/__tests__/StripeService.test.ts'
      ],
      transform: {
        '^.+\\.tsx?$': 'ts-jest'
      },
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts']
    },
    {
      displayName: 'web',
      testMatch: ['<rootDir>/src/components/**/*.test.{ts,tsx}'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest'
      },
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.web.ts']
    },
    {
      displayName: 'terminal',
      testMatch: ['<rootDir>/src/terminal/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest'
      },
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.terminal.ts']
    },
    {
      displayName: 'analytics',
      testMatch: ['<rootDir>/src/analytics/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest'
      },
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/src/tests/setup.analytics.ts']
    }
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/tests/**'
  ],
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage'
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
