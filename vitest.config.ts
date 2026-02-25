import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
      exclude: [
        'src/index.ts',
        'src/models/**',
        'src/*/index.ts',
        'src/**/*.test.ts',
      ],
    },
  },
})
