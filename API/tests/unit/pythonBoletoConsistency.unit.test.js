/**
 * pythonBoletoConsistency.unit.test.js
 *
 * Garante que o gerador Python (scripts/invoice_payment_generator.py) — caminho
 * PRIMÁRIO das rotas de boleto/PIX (invoiceController) — produza EXATAMENTE os
 * mesmos códigos que o buildBoletoData canônico (boletoMath.js), que alimenta o
 * PDF (página 4). Antes da correção o Python gerava o padrão antigo (fator 4,
 * DV posição 5, campo livre 25) e a linha digitável exibida no Telegram NÃO
 * batia com o barcode impresso no PDF.
 *
 * Se o Python não estiver instalado no ambiente, a suíte é pulada (skip).
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { buildBoletoData } = require('../../utils/boletoMath');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'invoice_payment_generator.py');

const CPF = '12312312312';
const NAME = 'Teste Massa';
const AMOUNT = 3870.86;
const DUEDATE = '2026-07-15';
const INVOICE_ID = 'FAT-202607';

function hasPython() {
    try {
        execFileSync('python', ['--version'], { stdio: 'pipe' });
        return true;
    } catch (e) {
        return false;
    }
}

function runPython() {
    const out = execFileSync('python', [
        SCRIPT, '--cpf', CPF, '--name', NAME, '--amount', String(AMOUNT),
        '--duedate', DUEDATE, '--invoiceid', INVOICE_ID, '--json'
    ], { encoding: 'utf-8', timeout: 20000 });
    return JSON.parse(out);
}

function jsCanonical() {
    return buildBoletoData({
        banco: '598', bancoDv: 9, bancoNome: '598 - Fintech Bank App',
        agencia: '0001', conta: '00000001', carteira: '09',
        nossoNumero: CPF.replace(/\D/g, '').slice(-10),
        documento: INVOICE_ID.replace(/[^0-9]/g, '').slice(0, 20) || CPF.replace(/\D/g, '').slice(-10),
        vencimento: DUEDATE + 'T00:00:00',
        emissao: new Date().toISOString(),
        valor: AMOUNT,
        sacado: NAME, sacadoCpf: CPF,
    });
}

const describeSuite = hasPython() ? describe : describe.skip;

describeSuite('Consistência Python ↔ JS (gerador de boleto/PIX)', () => {
    let py;
    let js;

    beforeAll(() => {
        py = runPython();
        js = jsCanonical();
    });

    it('linha digitável do Python é idêntica à canônica (47 dígitos)', () => {
        expect(py.boleto.linhaDigitavelRaw).toHaveLength(47);
        expect(py.boleto.linhaDigitavelRaw).toBe(js.linhaDigitavelRaw);
    });

    it('código de barras do Python é idêntico ao canônico (44 dígitos, DV posição 20)', () => {
        expect(py.boleto.barcode).toHaveLength(44);
        expect(py.boleto.barcode).toBe(js.codigoBarras);
        expect(py.boleto.barcode.slice(0, 3)).toBe('598');
        expect(py.boleto.barcode.slice(4, 9)).toBe(js.fator.padStart(5, '0'));
    });

    it('a linha digitável do Python é aceita pelo buildBoletoData (round-trip sem reconstrução divergente)', () => {
        const rt = buildBoletoData({
            linhaDigitavel: py.boleto.linhaDigitavel,
            valor: AMOUNT,
            vencimento: DUEDATE + 'T00:00:00'
        });
        expect(rt.linhaDigitavelRaw).toBe(py.boleto.linhaDigitavelRaw);
        expect(rt.codigoBarras).toBe(py.boleto.barcode);
    });

    it('fator de vencimento bate (5 dígitos)', () => {
        expect(String(py.boleto.dueDateFactor)).toBe(String(parseInt(js.fator, 10)));
    });

    it('PIX payload do Python é um EMV BR Code válido com CRC16', () => {
        const p = py.pix.payload;
        expect(p.startsWith('000201')).toBe(true);
        expect(p.slice(-4)).toMatch(/^[0-9A-F]{4}$/);
        expect(p).toContain('BR.GOV.BCB.PIX');
        expect(p).toContain('financeiro@fintechbank.com.br');
    });

    it('dados do pagador/beneficiário consistentes entre os dois geradores', () => {
        expect(py.boleto.payer.cpfFormatted).toBe('123.123.123-12');
        expect(py.boleto.beneficiary.bankCode).toBe('598');
        expect(py.boleto.beneficiary.bankName).toBe('598 - Fintech Bank App');
    });

    it('decode_boleto_from_code reconstrói o barcode a partir da linha digitável do Python', () => {
        // Importa o módulo Python e decodifica a linha gerada → mesmo barcode.
        const { execFileSync } = require('child_process');
        const out = execFileSync('python', [
            '-c',
            'import sys; sys.path.insert(0, "scripts"); '
            + 'from invoice_payment_generator import decode_boleto_from_code; '
            + 'import json; d = decode_boleto_from_code(sys.argv[1]); '
            + 'print(json.dumps(d))',
            py.boleto.linhaDigitavel
        ], { encoding: 'utf-8', timeout: 20000, cwd: path.join(__dirname, '..', '..', '..') });
        const decoded = JSON.parse(out);
        expect(decoded.bankCode).toBe('598');
        expect(decoded.dueDate).toBe('15/07/2026');
        expect(decoded.amount).toBe(AMOUNT);
        expect(decoded.barcode).toBe(py.boleto.barcode);
    });

    it('decode de código de barras (44) também reconstrói corretamente', () => {
        const { execFileSync } = require('child_process');
        const out = execFileSync('python', [
            '-c',
            'import sys; sys.path.insert(0, "scripts"); '
            + 'from invoice_payment_generator import decode_boleto_from_code; '
            + 'import json; d = decode_boleto_from_code(sys.argv[1]); '
            + 'print(json.dumps(d))',
            py.boleto.barcode
        ], { encoding: 'utf-8', timeout: 20000, cwd: path.join(__dirname, '..', '..', '..') });
        const decoded = JSON.parse(out);
        expect(decoded.barcode).toBe(py.boleto.barcode);
        expect(decoded.amount).toBe(AMOUNT);
        expect(decoded.dueDate).toBe('15/07/2026');
    });
});
