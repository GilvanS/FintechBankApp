// Testes do notificationsRepo.addNotification: regra de supressão do prefixo "🔔"
// quando o message já traz próprio cabeçalho (comprovante/aviso). Garante que o
// Telegram não recebe "🔔 Pagamento de fatura\n💵 COMPROVANTE..." duplicado.

// Mock telegramService.alertUser: captura o text enviado pra validar a regra.
const captured = [];
jest.mock('../../services/telegramService', () => ({
    alertUser: (cpf, text, _nome, _category) => { captured.push({ cpf, text }); },
    init: () => {},
}));
// O notificationsRepo faz `require('./context')` resolvido relativo a repositories/.
// Jest.mock precisa do mesmo caminho que o source resolve.
jest.mock('../../repositories/context', () => ({
    getDb: () => ({
        generateUUID: () => 'test-uuid',
        fq: (t) => `fintech.${t}`,
        executeQuery: async () => [],
    }),
    esc: (v) => `'${String(v).replace(/'/g, "''")}'`,
}));

const notificationsRepo = require('../../repositories/notificationsRepo');

describe('notificationsRepo.addNotification — supressão do prefixo 🔔', () => {
    beforeEach(() => { captured.length = 0; });

    test('comprovante de pagamento integral NÃO ganha prefixo 🔔', async () => {
        const message = [
            '💵 <b>COMPROVANTE DE PAGAMENTO INTEGRAL</b>',
            '',
            '<b>Cliente</b>    Teste',
        ].join('\n');
        await notificationsRepo.addNotification({
            cpf: '09086747329',
            title: 'Pagamento de fatura',
            message,
        });
        expect(captured).toHaveLength(1);
        expect(captured[0].text.startsWith('🔔')).toBe(false);
        expect(captured[0].text).toBe(message);
    });

    test('pagamento parcial com ⚠️ NÃO ganha prefixo 🔔', async () => {
        const message = '⚠️ <b>COMPROVANTE ABAIXO DO MÍNIMO</b>';
        await notificationsRepo.addNotification({ cpf: '11111111111', title: 'Aviso', message });
        expect(captured[0].text.startsWith('🔔')).toBe(false);
    });

    test('✅ (quitação) NÃO ganha prefixo 🔔', async () => {
        await notificationsRepo.addNotification({ cpf: '11111111111', title: 'OK', message: '✅ Pagamento confirmado' });
        expect(captured[0].text.startsWith('🔔')).toBe(false);
    });

    test('aviso sem cabeçalho ganha prefixo 🔔 ${title}', async () => {
        await notificationsRepo.addNotification({
            cpf: '11111111111',
            title: 'Cartão bloqueado',
            message: 'Detectamos uso atípico.',
        });
        expect(captured[0].text).toBe('🔔 Cartão bloqueado\nDetectamos uso atípico.');
    });

    test('espaços antes do emoji de cabeçalho são tolerados', async () => {
        await notificationsRepo.addNotification({
            cpf: '11111111111',
            title: 'X',
            message: '  💰 Saldo creditado',
        });
        expect(captured[0].text.startsWith('🔔')).toBe(false);
    });
});
