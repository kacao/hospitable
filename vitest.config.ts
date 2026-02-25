import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
      exclude: ['src/index.ts'],
    },
  },
})
