import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/*.test.{ts,tsx}',
    '<rootDir>/__tests__/**/*.test.mjs',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  projects: [
    {
      displayName: 'unit-tests',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}',
        '<rootDir>/src/**/*.test.{ts,tsx}',
      ],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'e2e-tests',
      testMatch: ['<rootDir>/__tests__/**/*.test.mjs'],
      testEnvironment: 'node',
    },
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
