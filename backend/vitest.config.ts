import { defineConfig } from 'vitest/config';

// Testes unitários: sem rede e sem banco. Os de integração têm configuração própria.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
