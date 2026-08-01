import React, { useRef, useEffect, useCallback } from 'react';
import type { PaymentCodesResponse } from '../services/api';

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface BoletoPrintViewProps {
  paymentCodes: PaymentCodesResponse['data'];
  onClose?: () => void;
  autoPrint?: boolean;
}

/**
 * Codifica um código de barras no padrão CODE128B para a linha digitável do boleto.
 * Renderiza em um <canvas> para impressão de alta qualidade.
 */
function drawBarcode128(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Tabela de valores CODE128B
  const CODE128B_START = 104;
  const CODE128B_STOP = 106;
  const CODE128_PATTERNS = [
    '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
    '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
    '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
    '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
    '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
    '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
    '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
    '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
    '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
    '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
    '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
    '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
    '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
    '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
    '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
    '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
    '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
    '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
    '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
    '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
    '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
    '11010011100', '1100011101011',
  ];

  // Limpa o canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calcula checksum e sequência de patterns
  const chars = text.split('').map(c => c.charCodeAt(0) - 32);
  let checksum = CODE128B_START;
  for (let i = 0; i < chars.length; i++) {
    checksum += chars[i] * (i + 1);
  }
  checksum %= 103;

  const fullSequence = [CODE128B_START, ...chars, checksum, CODE128B_STOP];
  let binary = '';
  for (const val of fullSequence) {
    const pattern = CODE128_PATTERNS[val];
    if (pattern) binary += pattern;
  }

  // Adiciona o stop pattern extra (trailing bar)
  binary += '1';

  // Renderiza
  const barWidth = canvas.width / binary.length;
  const barHeight = canvas.height - 4;
  const y = 2;

  ctx.fillStyle = '#000000';
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      ctx.fillRect(i * barWidth, y, Math.ceil(barWidth), barHeight);
    }
  }
}

const BoletoPrintView: React.FC<BoletoPrintViewProps> = ({ paymentCodes, onClose, autoPrint }) => {
  const barcodeRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barcodeRef.current && paymentCodes?.boleto?.linhaDigitavelRaw) {
      drawBarcode128(barcodeRef.current, paymentCodes.boleto.linhaDigitavelRaw);
    }
  }, [paymentCodes]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  if (!paymentCodes?.boleto) return null;

  const { boleto, invoice } = paymentCodes;
  const today = new Date().toLocaleDateString('pt-BR');
  const generatedTime = paymentCodes.generatedAt
    ? new Date(paymentCodes.generatedAt).toLocaleString('pt-BR')
    : today;

  return (
    <>
      {/* Botão de impressão (visível apenas na tela) */}
      <div className="print:hidden flex gap-2 mb-4">
        <button
          onClick={handlePrint}
          className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider bg-black text-white border-4 border-black shadow-[3px_3px_0px_0px_rgba(255,255,255,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:scale-[0.98]"
        >
          🖨️ Imprimir / Salvar PDF
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="py-3 px-5 rounded-2xl font-black text-xs uppercase tracking-wider bg-zinc-100 text-black border-4 border-black hover:bg-zinc-200 transition-all active:scale-95"
          >
            Fechar
          </button>
        )}
      </div>

      {/* ─── Boleto FEBRABAN ───────────────────────────────────────── */}
      <div
        ref={printRef}
        className="bg-white text-black"
        style={{
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          padding: '8mm 10mm',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '10pt',
          lineHeight: '1.4',
          color: '#000',
        }}
      >
        {/* ====== PARTE SUPERIOR ====== */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {/* Cabeçalho — Banco + Logo */}
            <tr>
              <td style={{ border: '1px solid #000', padding: '4px 6px', width: '60%', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '32px', height: '32px', backgroundColor: '#000', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '14pt', borderRadius: '2px'
                  }}>
                    {boleto.beneficiary.bankCode}
                  </div>
                  <span style={{ fontSize: '12pt', fontWeight: 'bold' }}>{boleto.beneficiary.bankName}</span>
                </div>
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 6px', width: '40%', textAlign: 'right', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recibo do Pagador
                </span>
              </td>
            </tr>

            {/* Linha Digitável */}
            <tr>
              <td colSpan={2} style={{
                border: '1px solid #000', borderTop: '2px solid #000',
                padding: '6px 6px', fontFamily: 'Courier New, monospace',
                fontSize: '13pt', fontWeight: 'bold', textAlign: 'center',
                letterSpacing: '1px', backgroundColor: '#f5f5f5'
              }}>
                {boleto.linhaDigitavel}
              </td>
            </tr>

            {/* Beneficiário / Cedente */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '9pt' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', padding: '1px 0', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Beneficiário (Cedente)</span>
                        <div style={{ fontWeight: 'bold' }}>{boleto.beneficiary.name}</div>
                        <div style={{ fontSize: '8pt' }}>CNPJ: {boleto.beneficiary.cnpj}</div>
                      </td>
                      <td style={{ width: '25%', padding: '1px 0', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Agência/Código</span>
                        <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>0001 / {boleto.beneficiary.bankCode}-1</div>
                      </td>
                      <td style={{ width: '25%', padding: '1px 0', verticalAlign: 'top', textAlign: 'right' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Vencimento</span>
                        <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{boleto.dueDateFormatted}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Pagador / Sacado */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '9pt' }}>
                <span style={{ fontSize: '7pt', color: '#555' }}>Pagador (Sacado)</span>
                <div style={{ fontWeight: 'bold' }}>{boleto.payer.name}</div>
                <div style={{ fontSize: '8pt' }}>CPF: {boleto.payer.cpfFormatted}</div>
              </td>
            </tr>

            {/* Endereço do Pagador (informativo) */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '8pt', color: '#555' }}>
                Endereço do Pagador: {boleto.payer.name} — CPF/CNPJ: {boleto.payer.cpfFormatted}
              </td>
            </tr>

            {/* Tabela de valores */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 6px', width: '18%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Nº Documento</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>{boleto.invoiceId.slice(0, 12)}</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '18%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Nosso Número</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>{boleto.invoiceId.slice(0, 12)}</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '10%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Espécie</span>
                        <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>R$</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '12%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Aceite</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>N</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '12%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Data Process.</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>{today}</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '30%', verticalAlign: 'top', textAlign: 'right' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Valor Documento</span>
                        <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{boleto.amountFormatted}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Valor Total */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontSize: '9pt' }}>
                <span style={{ fontSize: '7pt', color: '#555' }}>Valor Total</span>
                <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{boleto.amountFormatted}</div>
              </td>
            </tr>

            {/* Barcode */}
            <tr>
              <td colSpan={2} style={{
                border: '1px solid #000', padding: '4px 6px',
                textAlign: 'center'
              }}>
                <canvas
                  ref={barcodeRef}
                  width={480}
                  height={50}
                  style={{ width: '100%', maxWidth: '480px', height: '40px', margin: '0 auto', display: 'block' }}
                />
                <div style={{
                  fontFamily: 'Courier New, monospace', fontSize: '9pt',
                  fontWeight: 'bold', marginTop: '2px', letterSpacing: '1px'
                }}>
                  {boleto.barcode}
                </div>
              </td>
            </tr>

            {/* Informações adicionais */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '7.5pt', color: '#555' }}>
                <div>Fatura: {invoice.id}</div>
                <div>Gerado em: {generatedTime}</div>
                <div>Autorização mecânica | Fintech Bank App S.A. — {boleto.beneficiary.cnpj}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ====== LINHA DE CORTE ====== */}
        <div style={{
          margin: '6mm 0 4mm',
          borderTop: '2px dashed #999',
          position: 'relative',
          textAlign: 'center',
          height: '6mm'
        }}>
          <span style={{
            position: 'absolute', top: '-5px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#fff', padding: '0 8px',
            fontSize: '8pt', color: '#999', textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            Corte aqui
          </span>
        </div>

        {/* ====== PARTE DO BANCO / COMPROVANTE DE PAGAMENTO ====== */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '2mm' }}>
          <tbody>
            {/* Cabeçalho */}
            <tr>
              <td style={{ border: '1px solid #000', padding: '4px 6px', width: '60%', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '32px', height: '32px', backgroundColor: '#000', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '14pt', borderRadius: '2px'
                  }}>
                    {boleto.beneficiary.bankCode}
                  </div>
                  <span style={{ fontSize: '12pt', fontWeight: 'bold' }}>{boleto.beneficiary.bankName}</span>
                </div>
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 6px', width: '40%', textAlign: 'right', verticalAlign: 'middle' }}>
                <span style={{ fontSize: '8pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Comprovante de Pagamento
                </span>
              </td>
            </tr>

            {/* Linha Digitável (repetida) */}
            <tr>
              <td colSpan={2} style={{
                border: '1px solid #000', borderTop: '2px solid #000',
                padding: '6px 6px', fontFamily: 'Courier New, monospace',
                fontSize: '13pt', fontWeight: 'bold', textAlign: 'center',
                letterSpacing: '1px', backgroundColor: '#f5f5f5'
              }}>
                {boleto.linhaDigitavel}
              </td>
            </tr>

            {/* Beneficiário */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '9pt' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', padding: '1px 0', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Beneficiário (Cedente)</span>
                        <div style={{ fontWeight: 'bold' }}>{boleto.beneficiary.name}</div>
                      </td>
                      <td style={{ width: '25%', padding: '1px 0', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Agência/Cód. Cedente</span>
                        <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>0001 / {boleto.beneficiary.bankCode}-1</div>
                      </td>
                      <td style={{ width: '25%', padding: '1px 0', verticalAlign: 'top', textAlign: 'right' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Vencimento</span>
                        <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>{boleto.dueDateFormatted}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Pagador */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', fontSize: '9pt' }}>
                <span style={{ fontSize: '7pt', color: '#555' }}>Pagador (Sacado)</span>
                <div style={{ fontWeight: 'bold' }}>{boleto.payer.name}</div>
                <div style={{ fontSize: '8pt' }}>CPF: {boleto.payer.cpfFormatted}</div>
              </td>
            </tr>

            {/* Tabela de valores (parte inferior) */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 6px', width: '18%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Nº Documento</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>{boleto.invoiceId.slice(0, 12)}</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '18%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Nosso Número</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>{boleto.invoiceId.slice(0, 12)}</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '10%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Espécie</span>
                        <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>R$</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '12%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Aceite</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>N</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '12%', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Data Process.</span>
                        <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>{today}</div>
                      </td>
                      <td style={{ padding: '3px 6px', width: '30%', verticalAlign: 'top', textAlign: 'right' }}>
                        <span style={{ fontSize: '7pt', color: '#555' }}>Valor Documento</span>
                        <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{boleto.amountFormatted}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Valor Total (parte inferior) */}
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'right', fontSize: '9pt' }}>
                <span style={{ fontSize: '7pt', color: '#555' }}>Valor Total</span>
                <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>{boleto.amountFormatted}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Rodapé com informações do banco */}
        <div style={{
          marginTop: '4mm', fontSize: '7pt', color: '#888',
          textAlign: 'center', lineHeight: '1.6',
          borderTop: '1px solid #ddd', paddingTop: '2mm'
        }}>
          <div>Fintech Bank App S.A. — {boleto.beneficiary.cnpj}</div>
          <div>SAC: 0800 123 4567 | Ouvidoria: 0800 765 4321</div>
          <div>Este boleto é gerado automaticamente e não requer autenticação.</div>
          <div>www.fintechbank.com.br</div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 6mm 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default BoletoPrintView;
