import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroEnvioEmail } from '../../modules/alerts/envio.js';
import { criarProvedorEmailResend, REMETENTE_PADRAO } from './cliente-resend.js';

const { enviarMock, ResendMock } = vi.hoisted(() => {
  const enviarMock = vi.fn();
  // Construtor precisa ser function para funcionar com `new`.
  const ResendMock = vi.fn(function MockResend() {
    return { emails: { send: enviarMock } };
  });
  return { enviarMock, ResendMock };
});

vi.mock('resend', () => ({ Resend: ResendMock }));

const MENSAGEM = {
  para: 'pessoa@exemplo.com',
  assunto: 'Nova ameaça: teste',
  html: '<p>oi</p>',
  texto: 'oi',
};

describe('criarProvedorEmailResend', () => {
  beforeEach(() => {
    enviarMock.mockReset();
    ResendMock.mockClear();
  });

  it('envia com a chave de idempotência e o remetente padrão', async () => {
    enviarMock.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
    const provedor = criarProvedorEmailResend({ apiKey: 'chave-de-teste' });

    const id = await provedor.enviar(MENSAGEM, 'alert:1');

    expect(ResendMock).toHaveBeenCalledWith('chave-de-teste');
    expect(enviarMock).toHaveBeenCalledWith(
      {
        from: REMETENTE_PADRAO,
        to: MENSAGEM.para,
        subject: MENSAGEM.assunto,
        html: MENSAGEM.html,
        text: MENSAGEM.texto,
      },
      { idempotencyKey: 'alert:1' },
    );
    expect(id).toBe('msg-1');
  });

  it('usa o remetente configurado quando informado', async () => {
    enviarMock.mockResolvedValue({ data: { id: 'msg-2' }, error: null });
    const provedor = criarProvedorEmailResend({
      apiKey: 'chave-de-teste',
      remetente: 'Alertas <alertas@meudominio.com.br>',
    });

    await provedor.enviar(MENSAGEM, 'alert:2');

    expect(enviarMock.mock.calls[0]?.[0]).toMatchObject({
      from: 'Alertas <alertas@meudominio.com.br>',
    });
  });

  it('erro de limite de taxa é temporário', async () => {
    enviarMock.mockResolvedValue({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'x', statusCode: 429 },
    });
    const provedor = criarProvedorEmailResend({ apiKey: 'k' });

    const erro = await provedor.enviar(MENSAGEM, 'alert:3').catch((falha: unknown) => falha);

    expect(erro).toBeInstanceOf(ErroEnvioEmail);
    expect((erro as ErroEnvioEmail).temporario).toBe(true);
  });

  it('chave inválida é definitiva e não repassa a mensagem bruta da Resend', async () => {
    enviarMock.mockResolvedValue({
      data: null,
      error: { name: 'invalid_api_key', message: 're_segredo_123 inválida', statusCode: 401 },
    });
    const provedor = criarProvedorEmailResend({ apiKey: 'k' });

    const erro = (await provedor
      .enviar(MENSAGEM, 'alert:4')
      .catch((falha: unknown) => falha)) as ErroEnvioEmail;

    expect(erro.temporario).toBe(false);
    expect(erro.message).toBe('Chave da Resend inválida.');
    expect(erro.message).not.toContain('re_segredo');
  });

  it('código desconhecido é definitivo, com mensagem genérica', async () => {
    enviarMock.mockResolvedValue({
      data: null,
      error: { name: 'algum_codigo_novo', message: 'x', statusCode: 400 },
    });
    const provedor = criarProvedorEmailResend({ apiKey: 'k' });

    const erro = (await provedor
      .enviar(MENSAGEM, 'alert:5')
      .catch((falha: unknown) => falha)) as ErroEnvioEmail;

    expect(erro.temporario).toBe(false);
    expect(erro.message).toBe('Envio recusado pela Resend.');
  });

  it('falha de rede é temporária', async () => {
    enviarMock.mockRejectedValue(new Error('ECONNRESET'));
    const provedor = criarProvedorEmailResend({ apiKey: 'k' });

    const erro = (await provedor
      .enviar(MENSAGEM, 'alert:6')
      .catch((falha: unknown) => falha)) as ErroEnvioEmail;

    expect(erro.temporario).toBe(true);
    expect(erro.message).toBe('Falha de rede ao falar com a Resend.');
    expect(erro.message).not.toContain('ECONNRESET');
  });
});
