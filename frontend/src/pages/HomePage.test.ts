import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage.vue';

describe('HomePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra o nome e a frase da marca', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));

    const pagina = mount(HomePage);

    expect(pagina.get('h1').text()).toBe('SENTINELA');
    expect(pagina.text()).toContain('Inteligência que antecipa ameaças.');
  });

  it('mostra a API como online quando a verificação passa', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );

    const pagina = mount(HomePage);
    await flushPromises();

    expect(pagina.text()).toContain('Status da API: online');
  });

  it('mostra a API como indisponível quando a verificação falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const pagina = mount(HomePage);
    await flushPromises();

    expect(pagina.text()).toContain('Status da API: indisponível');
  });
});
