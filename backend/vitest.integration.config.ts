import { defineConfig } from 'vitest/config';

// Testes de integração falam com o projeto Supabase real. Rodam sob demanda: npm run test:integration.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Os cenários criam e apagam usuários no mesmo projeto, então rodam em sequência.
    fileParallelism: false,
  },
});
