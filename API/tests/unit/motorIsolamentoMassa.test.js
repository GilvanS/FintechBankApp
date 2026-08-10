/**
 * Teste Unitário — Isolamento de falhas por massa nos motores diários (T2)
 *
 * Contexto do bug corrigido:
 *   runBillingValidation (index.cjs) e invoiceEngine.runEngine iteravam sobre todas as
 *   massas sem try/catch individual. Um erro em qualquer CPF abortava o laço inteiro:
 *   as massas seguintes ficavam sem encargos/fechamento no dia, silenciosamente.
 *   O alerta do Telegram enviava apenas e.message, sem dizer QUAL massa quebrou.
 *
 * O index.cjs não exporta módulos utilizáveis em teste unitário (roda bootstrap/cron ao
 * ser importado). Seguindo o padrão já usado em tests/unit/diasAtrasoSync.test.js e
 * billingEngine.test.js, o padrão de isolamento é reproduzido aqui como função
 * standalone com a MESMA forma do código de produção.
 */

// ─── Reprodução do padrão aplicado nos dois motores ──────────────────────────
// Espelha: for (const u of users) { try { ...corpo... } catch (massErr) {
//   errors.push({ cpf, etapa, mensagem }); console.error(...); } }
async function processarComIsolamento(massas, processarUma, etapa = 'billing_validation') {
    let processadas = 0;
    const errors = [];

    for (const m of massas) {
        try {
            await processarUma(m);
            processadas++;
        } catch (massErr) {
            errors.push({ cpf: m.cpf, etapa, mensagem: massErr.message });
        }
    }

    return { success: true, processadas, falhas: errors.length, errors };
}

// ─── Reprodução do reportarResultadoMotor (index.cjs) ────────────────────────
const MAX_CPFS_NO_ALERTA = 20;
function montarMensagemAlerta(nomeMotor, result) {
    const errors = (result && result.errors) || [];
    if (!errors.length) return null;

    const listados = errors.slice(0, MAX_CPFS_NO_ALERTA)
        .map(e => `- ${e.cpf} (${e.etapa}): ${e.mensagem}`)
        .join('\n');
    const restantes = errors.length > MAX_CPFS_NO_ALERTA
        ? `\n... e mais ${errors.length - MAX_CPFS_NO_ALERTA} massa(s).`
        : '';

    return `${nomeMotor}: ${result.processadas ?? result.processed ?? '?'} processada(s), ` +
           `${errors.length} com falha.\n${listados}${restantes}`;
}

const massas = (n) => Array.from({ length: n }, (_, i) => ({ cpf: String(i + 1).padStart(11, '0') }));

// ─── Suite 1: uma massa com erro não derruba as seguintes ────────────────────

describe('Isolamento por massa — o laço continua após uma falha', () => {
    it('processa as 4 massas restantes quando a 2ª de 5 falha', async () => {
        const tocadas = [];
        const result = await processarComIsolamento(massas(5), async (m) => {
            tocadas.push(m.cpf);
            if (m.cpf === '00000000002') throw new Error('coluna inexistente');
        });

        // A garantia central: TODAS as massas foram visitadas, não só as anteriores ao erro.
        expect(tocadas).toHaveLength(5);
        expect(result.processadas).toBe(4);
        expect(result.falhas).toBe(1);
    });

    it('identifica a massa que falhou com cpf, etapa e mensagem', async () => {
        const result = await processarComIsolamento(massas(3), async (m) => {
            if (m.cpf === '00000000003') throw new Error('divisao por zero');
        });

        expect(result.errors).toEqual([
            { cpf: '00000000003', etapa: 'billing_validation', mensagem: 'divisao por zero' }
        ]);
    });

    it('acumula múltiplas falhas sem interromper o processamento', async () => {
        const result = await processarComIsolamento(massas(6), async (m) => {
            if (['00000000002', '00000000004'].includes(m.cpf)) throw new Error('falha');
        });

        expect(result.processadas).toBe(4);
        expect(result.falhas).toBe(2);
        expect(result.errors.map(e => e.cpf)).toEqual(['00000000002', '00000000004']);
    });

    it('não reporta falha quando todas as massas processam com sucesso', async () => {
        const result = await processarComIsolamento(massas(4), async () => {});

        expect(result.processadas).toBe(4);
        expect(result.falhas).toBe(0);
        expect(result.errors).toEqual([]);
    });

    it('registra a etapa correta do motor de faturas', async () => {
        const result = await processarComIsolamento(
            massas(2),
            async (m) => { if (m.cpf === '00000000001') throw new Error('due_date invalido'); },
            'invoice_engine'
        );

        expect(result.errors[0].etapa).toBe('invoice_engine');
    });
});

// ─── Suite 2: o alerta do Telegram identifica as massas ──────────────────────

describe('Alerta do Telegram — identifica quais massas falharam', () => {
    it('não envia alerta quando não houve falha', () => {
        const msg = montarMensagemAlerta('Invoice Engine', { processadas: 10, errors: [] });
        expect(msg).toBeNull();
    });

    it('cita o CPF, a etapa e a mensagem de erro', () => {
        const msg = montarMensagemAlerta('Validacao de faturamento', {
            processadas: 53,
            errors: [{ cpf: '12345678901', etapa: 'billing_validation', mensagem: 'timeout' }]
        });

        expect(msg).toContain('12345678901');
        expect(msg).toContain('billing_validation');
        expect(msg).toContain('timeout');
        expect(msg).toContain('53 processada(s), 1 com falha');
    });

    it('trunca em 20 CPFs e informa quantas massas ficaram de fora', () => {
        const errors = Array.from({ length: 25 }, (_, i) => ({
            cpf: String(i).padStart(11, '0'), etapa: 'billing_validation', mensagem: 'erro'
        }));
        const msg = montarMensagemAlerta('Validacao de faturamento', { processadas: 29, errors });

        expect(msg.match(/^- /gm)).toHaveLength(20);
        expect(msg).toContain('... e mais 5 massa(s).');
    });

    it('aceita o campo processed do invoiceEngine além de processadas', () => {
        const msg = montarMensagemAlerta('Invoice Engine', {
            processed: 7,
            errors: [{ cpf: '00000000001', etapa: 'invoice_engine', mensagem: 'erro' }]
        });

        expect(msg).toContain('7 processada(s)');
    });
});
