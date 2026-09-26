const {
    CRITERIOS, criterioDaAnomalia, mensagensDoCriterio, resumoGeral, enviarAlertasAuditoria,
} = require('../../services/auditAlerts');

const anomalia = (type, cpf = '12345678901', details = 'detalhe') => ({ type, cpf, name: `Massa ${cpf}`, details });

describe('criterioDaAnomalia', () => {
    test.each([
        ['PAGAMENTO_EXCEDENTE_FATURA_FECHADA', 'pagamentos'],
        ['SALDO_CREDOR_ESTACIONADO', 'pagamentos'],
        ['TRANSACAO_ORFA', 'compras'],
        ['LIMITE_DIVERGENTE', 'limite'],
        ['FATURA_DUPLICADA', 'faturas'],
        ['BLACKLIST_DESSINCRONIZADA', 'faturas'],
        // Tipos novos caem pelo nome
        ['PIX_SEM_COMPROVANTE', 'pix'],
        ['COMPRA_DUPLICADA', 'compras'],
        ['ALGO_DESCONHECIDO', 'faturas'],
    ])('%s → %s', (tipo, criterio) => {
        expect(criterioDaAnomalia(tipo)).toBe(criterio);
    });
});

describe('mensagensDoCriterio', () => {
    test('uma mensagem com cabeçalho do critério e uma linha por anomalia', () => {
        const [msg, ...resto] = mensagensDoCriterio('limite', [anomalia('LIMITE_EXCEDIDO', '11111111111'), anomalia('LIMITE_DIVERGENTE', '22222222222')]);

        expect(resto).toEqual([]);
        expect(msg).toContain('📉 Limite: 2 anomalia(s)');
        expect(msg).toContain('<code>111.111.111-11</code>');
        expect(msg).toContain('<b>LIMITE_DIVERGENTE</b>');
    });

    test('escapa HTML vindo dos detalhes (descrição livre de transação)', () => {
        const [msg] = mensagensDoCriterio('compras', [anomalia('TRANSACAO_ORFA', '1', 'Loja <X> & Cia')]);
        expect(msg).toContain('Loja &lt;X&gt; &amp; Cia');
    });

    test('quebra abaixo do limite do Telegram e para em 3 mensagens com "… e mais N"', () => {
        const muitas = Array.from({ length: 200 }, (_, i) => anomalia('LIMITE_EXCEDIDO', String(i).padStart(11, '0'), 'x'.repeat(150)));
        const msgs = mensagensDoCriterio('limite', muitas);

        expect(msgs).toHaveLength(3);
        for (const m of msgs) expect(m.length).toBeLessThan(4096);
        expect(msgs[0]).toContain('(1/3)');
        const listadas = msgs.join('\n').match(/• <b>/g).length;
        expect(msgs[2]).toContain(`… e mais ${200 - listadas}`);
    });
});

describe('mensagensDoCriterio — tipos de baixo volume não somem (Task 4 fix 1)', () => {
    test('300 da 8d não escondem a 8f nem a BLACKLIST; o rodapé diz o que foi cortado', () => {
        const muitas = Array.from({ length: 300 }, (_, i) => anomalia('SALDO_ANTERIOR_DIVERGENTE', String(i).padStart(11, '0'), 'x'.repeat(150)));
        const msgs = mensagensDoCriterio('faturas', [...muitas, anomalia('RESIDUAL_PARCIAL_SEM_ENCARGO'), anomalia('BLACKLIST_DESSINCRONIZADA')]);
        expect(msgs).toHaveLength(3);
        expect(msgs[0]).toContain('<b>RESIDUAL_PARCIAL_SEM_ENCARGO</b>');
        expect(msgs[0]).toContain('<b>BLACKLIST_DESSINCRONIZADA</b>');
        expect(msgs[2]).toMatch(/… e mais \d+ \(SALDO_ANTERIOR_DIVERGENTE: \d+\)/);
    });
});

describe('resumoGeral', () => {
    test('conta por critério e por tipo', () => {
        const txt = resumoGeral([anomalia('LIMITE_EXCEDIDO'), anomalia('LIMITE_EXCEDIDO'), anomalia('TRANSACAO_ORFA')]);
        expect(txt).toContain('3 encontrada(s)');
        expect(txt).toContain('📉 Limite: <b>2</b>');
        expect(txt).toContain('🛒 Compras: <b>1</b>');
        expect(txt).toContain('• LIMITE_EXCEDIDO: 2');
    });
});

describe('enviarAlertasAuditoria', () => {
    test('1 mensagem por critério no tópico dele + 1 resumo no General, tudo sob daily_anomaly', () => {
        const tg = { alertTopic: jest.fn(), alertGroup: jest.fn() };
        enviarAlertasAuditoria(tg, [anomalia('LIMITE_EXCEDIDO'), anomalia('LIMITE_DIVERGENTE'), anomalia('PAGAMENTO_SEM_COMPROVANTE')]);

        expect(tg.alertTopic).toHaveBeenCalledTimes(2);
        expect(tg.alertTopic).toHaveBeenCalledWith(CRITERIOS.limite.topico, expect.stringContaining('2 anomalia(s)'), 'daily_anomaly');
        expect(tg.alertTopic).toHaveBeenCalledWith(CRITERIOS.pagamentos.topico, expect.any(String), 'daily_anomaly');
        expect(tg.alertGroup).toHaveBeenCalledTimes(1);
        expect(tg.alertGroup).toHaveBeenCalledWith(expect.stringContaining('3 encontrada(s)'), 'daily_anomaly');
    });

    test('sem anomalias não envia nada', () => {
        const tg = { alertTopic: jest.fn(), alertGroup: jest.fn() };
        enviarAlertasAuditoria(tg, []);
        expect(tg.alertTopic).not.toHaveBeenCalled();
        expect(tg.alertGroup).not.toHaveBeenCalled();
    });
});
