import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carrega o .env da raiz do repositório. Não sobrescreve variáveis já definidas no ambiente.
const CAMINHO_ENV = resolve(import.meta.dirname, '../../../.env');

if (existsSync(CAMINHO_ENV)) {
  process.loadEnvFile(CAMINHO_ENV);
}
