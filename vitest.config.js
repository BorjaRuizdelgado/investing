import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.{js,ts}', 'src/**/*.test.{js,ts}'],
    environment: 'node',
  },
})
