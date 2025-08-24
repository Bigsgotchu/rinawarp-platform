const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/*.e2e.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 30000,
  coverageDirectory: 'coverage/e2e',
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
