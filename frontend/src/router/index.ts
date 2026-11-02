import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useSessaoStore } from '@/stores/sessao';

declare module 'vue-router' {
  interface RouteMeta {
    titulo?: string;
    /** Página de visitante (entrar e cadastro). Usuário logado é redirecionado para o painel. */
    publica?: boolean;
    /** Exige sessão. Vale para a rota e para as filhas dela. */
    requerLogin?: boolean;
  }
}

const TITULO_PADRAO = 'SENTINELA';

const rotas: RouteRecordRaw[] = [
  {
    path: '/entrar',
    name: 'entrar',
    component: () => import('@/pages/EntrarPage.vue'),
    meta: { titulo: 'Entrar', publica: true },
  },
  {
    path: '/cadastro',
    name: 'cadastro',
    component: () => import('@/pages/CadastroPage.vue'),
    meta: { titulo: 'Criar conta', publica: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/LayoutAplicacao.vue'),
    meta: { requerLogin: true },
    children: [
      {
        path: '',
        name: 'painel',
        component: () => import('@/pages/PainelPage.vue'),
        meta: { titulo: 'Painel' },
      },
      {
        path: 'ameacas',
        name: 'ameacas',
        component: () => import('@/pages/AmeacasPage.vue'),
        meta: { titulo: 'Threat Intelligence' },
      },
      {
        path: 'ameacas/:id',
        name: 'ameaca',
        component: () => import('@/pages/AmeacaDetalhePage.vue'),
        meta: { titulo: 'Detalhes da ameaça' },
      },
      {
        path: 'detector',
        name: 'detector',
        component: () => import('@/pages/DetectorPage.vue'),
        meta: { titulo: 'Detector de phishing' },
      },
      {
        path: 'resultados/:id',
        name: 'resultado',
        component: () => import('@/pages/ResultadoPage.vue'),
        meta: { titulo: 'Resultado da análise' },
      },
      {
        path: 'historico',
        name: 'historico',
        component: () => import('@/pages/HistoricoPage.vue'),
        meta: { titulo: 'Histórico' },
      },
      {
        path: 'alertas',
        name: 'alertas',
        component: () => import('@/pages/AlertasPage.vue'),
        meta: { titulo: 'Alertas' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'painel' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes: rotas,
});

router.beforeEach(async (para) => {
  const sessao = useSessaoStore();
  await sessao.iniciar();

  const exigeLogin = para.matched.some((rota) => rota.meta.requerLogin === true);

  if (exigeLogin && !sessao.autenticado) {
    return { name: 'entrar', query: { redirect: para.fullPath } };
  }

  if (para.meta.publica === true && sessao.autenticado) {
    return { name: 'painel' };
  }

  return true;
});

router.afterEach((para) => {
  document.title = para.meta.titulo ? `${para.meta.titulo} · ${TITULO_PADRAO}` : TITULO_PADRAO;
});

/**
 * Aceita redirecionamento só para caminhos internos do próprio site.
 * Impede que o parâmetro ?redirect= leve o usuário para outro domínio.
 */
export function destinoSeguro(destino: unknown): string {
  if (typeof destino !== 'string' || !destino.startsWith('/')) {
    return '/';
  }
  // Os navegadores tratam "/\" e "//" da mesma forma: ambos viram um endereço externo.
  if (destino.startsWith('//') || destino.startsWith('/\\')) {
    return '/';
  }
  return destino;
}
