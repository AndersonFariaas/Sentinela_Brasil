import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await buildApp(env);

async function encerrar(sinal: NodeJS.Signals): Promise<void> {
  app.log.info({ sinal }, 'encerrando servidor');
  await app.close();
  process.exit(0);
}

process.once('SIGINT', (sinal) => void encerrar(sinal));
process.once('SIGTERM', (sinal) => void encerrar(sinal));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error({ err: error }, 'falha ao iniciar o servidor');
  process.exit(1);
}
