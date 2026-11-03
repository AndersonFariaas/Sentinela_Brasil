import { describe, expect, it } from 'vitest';
import { OPCOES_CISA_KEV, URL_CATALOGO_KEV } from '../integrations/threat-feeds/cisa-kev.js';
import { HOSTS_COLETA_PERMITIDOS } from './egress.js';

describe('HOSTS_COLETA_PERMITIDOS', () => {
  it('libera apenas o host do feed da CISA hoje', () => {
    expect(HOSTS_COLETA_PERMITIDOS).toEqual(['www.cisa.gov']);
  });

  it('o adaptador da CISA usa a mesma lista e o host do feed está nela', () => {
    expect(OPCOES_CISA_KEV.hostsPermitidos).toBe(HOSTS_COLETA_PERMITIDOS);
    expect(HOSTS_COLETA_PERMITIDOS).toContain(new URL(URL_CATALOGO_KEV).hostname);
  });
});
