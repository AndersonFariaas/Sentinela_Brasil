import type { FastifyPluginCallback } from 'fastify';

export const healthRoutes: FastifyPluginCallback = (app, _opcoes, done) => {
  app.get('/health', () => ({ status: 'ok' }));
  done();
};
