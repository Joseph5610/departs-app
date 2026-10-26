import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': `${import.meta.dirname}/src`, '@shared': `${import.meta.dirname}/shared` },
  },
  test: {
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts', 'shared/**/*.test.ts'],
    environment: 'node',
  },
})
