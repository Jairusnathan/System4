const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/lib/**/*.{ts,tsx}',
    '!<rootDir>/src/lib/mailer.ts',
    '!<rootDir>/src/lib/philippine-locations.ts',
    '!<rootDir>/src/lib/second-supabase.ts',
    '!<rootDir>/src/lib/supabase.ts',
    '<rootDir>/src/types.ts',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
};

module.exports = createJestConfig(customJestConfig);
