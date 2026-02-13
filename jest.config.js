module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/*/src', '<rootDir>/packages/*/test'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  projects: [
    {
      displayName: 'extension',
      testMatch: ['<rootDir>/packages/extension/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/packages/extension/test/setup.ts']
    },
    {
      displayName: 'mcp-server',
      testMatch: ['<rootDir>/packages/mcp-server/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/packages/mcp-server/test/setup.ts']
    }
  ]
};
