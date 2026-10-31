// Permite ao ESLint (que usa o TypeScript sem o vue-tsc) importar arquivos .vue.
// O vue-tsc continua usando os tipos reais de cada componente.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const componente: DefineComponent<object, object, unknown>;
  export default componente;
}
