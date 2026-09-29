import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import PasswordModal from '../PasswordModal';
import {
  getInvoiceInstallmentOptions,
  getRenegotiationOptions,
  parcelCreditCardInvoice,
  renegotiateCreditCardDebt,
  TIPOS_ENTRADA,
  type InstallmentPlan,
  type InstallmentReceipt,
} from '../../services/api';
import type { User } from '../../types';

/**
 * Simulação e contratação de PF e Reneg em UMA tela web (formato dos prints reais em
 * docs/referencias-pf-pa-reneg.md): abas de produto no topo, barra de 3 passos, campo
 * único "Valor da Entrada" (0,00 = sem entrada) que recalcula as parcelas sozinho e a
 * lista de parcelas recomendadas em 2 colunas. PF vai até 10x; ao trocar a aba para
 * Reneg a mesma tela expande até 36x.
 */

export type ContractProduct = 'pf' | 'reneg';
type View = 'simulacao' | 'proposta' | 'concluido';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  initialProduct: ContractProduct;
  /** Reneg só existe para conta bloqueada ou na lista negra (regra do backend). */
  renegElegivel: boolean;
  onBack: () => void;
  onContracted: () => void;
  onFinish: (verParcelamentos: boolean) => void;
}

const CONFIG = {
  pf: { aba: 'Parcelamento de Fatura', tipo: 'Parcelamento de Fatura', max: 10, taxaPadrao: 0.0795, escopo: 'fatura fechada' },
  reneg: { aba: 'Renegociação', tipo: 'Renegociação', max: 36, taxaPadrao: 0.042, escopo: 'faturas + encargos' },
} as const;

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (fraction: number) => `${(fraction * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const anual = (mensal: number) => Math.pow(1 + mensal, 12) - 1;
const mensalDeAnual = (aa: number) => Math.pow(1 + aa, 1 / 12) - 1;
// Campo de entrada só aceita dígitos e vírgula: "444,55" → 444.55 (ponto = milhar não é digitado).
const parseEntrada = (raw: string) => {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function InstallmentContractAllureView({ user, theme, initialProduct, renegElegivel, onBack, onContracted, onFinish }: Props) {
  const isMidnight = theme === 'midnight';
  const [product, setProduct] = useState<ContractProduct>(initialProduct);
  const [view, setView] = useState<View>('simulacao');
  const [entradaRaw, setEntradaRaw] = useState('0,00');
  const [qtdRaw, setQtdRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [options, setOptions] = useState<InstallmentPlan[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contractError, setContractError] = useState('');
  const [receipt, setReceipt] = useState<InstallmentReceipt | null>(null);
  // Conta elegível à Reneg (bloqueada/lista negra) que abre a tela pelo PF: oferece a Reneg uma vez.
  const [renegOfferOpen, setRenegOfferOpen] = useState(renegElegivel && initialProduct === 'pf');

  const cfg = CONFIG[product];
  const entrada = parseEntrada(entradaRaw);
  const tipoEntrada = entrada > 0 ? TIPOS_ENTRADA.ENTRADA_DIFERENTE : TIPOS_ENTRADA.SEM_ENTRADA;
  const valorAParcelar = amount === null ? null : Math.max(0, amount - entrada);
  const quantidade = parseInt(qtdRaw, 10);
  const plano = useMemo(() => options.find((o) => o.installments === quantidade) ?? null, [options, quantidade]);
  const taxaMensal = options[0]?.monthlyRate ?? cfg.taxaPadrao;
  const recomendadas = useMemo(() => options.filter((o) => o.installments >= 3), [options]);

  // Recalcula as parcelas sozinho quando muda produto ou entrada (com um respiro pra não
  // consultar a API a cada tecla).
  useEffect(() => {
    if (view !== 'simulacao') return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      const getOptions = product === 'reneg' ? getRenegotiationOptions : getInvoiceInstallmentOptions;
      const res = await getOptions({ tipoEntrada, novaEntrada: entrada > 0 ? entrada : undefined });
      if (!active) return;
      if (res.success && res.options) {
        setAmount(res.amount ?? 0);
        setOptions(res.options);
        setLoadError('');
      } else {
        setOptions([]);
        setLoadError(res.message || 'Não foi possível carregar as opções.');
      }
      setLoading(false);
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [product, entrada, tipoEntrada, view]);

  const trocarProduto = (p: ContractProduct) => {
    if (p === product || view !== 'simulacao') return;
    if (p === 'reneg' && !renegElegivel) return;
    setProduct(p);
    setQtdRaw('');
    setAmount(null);
    setOptions([]);
  };

  const handleConfirmPin = async (pin: string) => {
    if (!user || !plano) return;
    setSubmitting(true);
    setContractError('');
    try {
      const contract = product === 'reneg' ? renegotiateCreditCardDebt : parcelCreditCardInvoice;
      const res = await contract(user.cpf, { installments: plano.installments, tipoEntrada, novaEntrada: entrada > 0 ? entrada : undefined }, pin);
      setPinOpen(false);
      if (res.success) {
        setReceipt(res.receipt ?? null);
        setView('concluido');
        onContracted();
      } else {
        setContractError(res.message || 'Não foi possível concluir a contratação.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── estilos ────────────────────────────────────────────────────────────────
  const muted = isMidnight ? 'text-on-surface-variant' : 'text-black/60';
  const pageBg = isMidnight ? 'bg-volt-dark' : 'bg-volt-yellow';
  const accent = isMidnight ? 'bg-volt-green' : 'bg-black';
  const rule = isMidnight ? 'border-white/10' : 'border-black/20';
  // Mobile: botões empilhados em largura total (primário em cima); ≥sm: lado a lado à direita.
  const actionsRow = 'flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 [&>button]:w-full sm:[&>button]:w-auto';
  const btnPrimary = `px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-opacity disabled:opacity-40 disabled:pointer-events-none hover:opacity-90 ${isMidnight ? 'bg-volt-green text-black' : 'bg-black text-white'}`;
  const btnSecondary = `px-8 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${isMidnight ? 'border border-white/20 text-white hover:bg-white/10' : 'border-2 border-black bg-white text-black hover:bg-black/5'}`;
  const fieldBox = `w-full rounded-lg border-2 px-4 py-3 font-black text-base outline-none ${isMidnight ? 'bg-transparent border-white/20 focus:border-volt-green' : 'bg-white border-black/40 focus:border-black'}`;

  const Heading = ({ children }: { children: React.ReactNode }) => (
    <h3 className={`text-sm font-black uppercase tracking-wider pb-2 border-b ${rule}`}>{children}</h3>
  );
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="relative">
      <span className={`absolute -top-2 left-3 px-1 text-[10px] font-bold z-10 ${pageBg} ${muted}`}>{label}</span>
      {children}
    </div>
  );
  const Line = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-baseline gap-2 sm:gap-4 py-2">
      <span className={`text-xs font-bold ${muted}`}>{label}</span>
      <span className="text-sm font-black text-right min-w-0 break-words">{value}</span>
    </div>
  );

  const passoAtual = view === 'simulacao' ? 1 : view === 'proposta' ? 2 : 3;
  const titulos = ['Dados da simulação', 'Simulação da proposta', 'Concluído'];
  const progresso = (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-3">
        {titulos.map((t, i) => (
          <div key={t} className={`h-1 rounded-full ${i < passoAtual ? accent : isMidnight ? 'bg-white/15' : 'bg-black/20'}`} />
        ))}
      </div>
      <p className="text-lg font-black">{titulos[passoAtual - 1]}</p>
    </div>
  );

  // ── telas ──────────────────────────────────────────────────────────────────
  const renderSimulacao = () => (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <Heading>Informações sobre o parcelamento</Heading>
        <Line label="Cliente elegível ao sem entrada?" value="Sim" />
        <div className="flex flex-wrap justify-between gap-4">
          <div className="flex gap-4 items-baseline">
            <span className={`text-xs font-bold ${muted}`}>Valor total da dívida</span>
            <span className="text-sm font-black">{amount === null ? '—' : fmt(amount)}</span>
            <span className={`text-[10px] font-bold ${muted}`}>({cfg.escopo})</span>
          </div>
          <div className="flex gap-4 items-baseline">
            <span className={`text-xs font-bold ${muted}`}>Pagamento Mínimo</span>
            <span className="text-sm font-black">{fmt(0)}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <Heading>Detalhes do parcelamento</Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <Field label="Valor da Entrada">
            <input
              aria-label="Valor da Entrada"
              type="text"
              inputMode="decimal"
              value={entradaRaw}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setEntradaRaw(e.target.value.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, ''))}
              className={fieldBox}
            />
          </Field>
          <Field label="Valor a Parcelar">
            <input aria-label="Valor a Parcelar" readOnly disabled value={valorAParcelar === null ? '' : fmt(valorAParcelar)} className={`${fieldBox} opacity-60`} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-black">Quantidade de Parcelas:</p>
            <Field label="Quantidade">
              <input
                aria-label="Quantidade"
                type="number"
                min={2}
                max={cfg.max}
                value={qtdRaw}
                onChange={(e) => setQtdRaw(e.target.value)}
                className={fieldBox}
              />
            </Field>
            <p className={`text-[10px] font-bold ${muted}`}>Aceita de 2x a {cfg.max}x</p>
            {qtdRaw !== '' && !plano && !loading && !loadError && (
              <p className="text-xs font-bold text-rose-400">Informe de 2x a {cfg.max}x.</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-black">Parcelas Recomendadas:</p>
            {loading ? (
              <p className={`text-xs font-bold ${muted}`}>Calculando…</p>
            ) : loadError ? (
              <p className="flex items-center gap-2 text-xs font-bold text-rose-400"><AlertCircle size={14} /> {loadError}</p>
            ) : (
              <div role="radiogroup" aria-label="Parcelas Recomendadas" className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-6 gap-y-3 max-h-[300px] overflow-y-auto pr-2">
                {recomendadas.map((o) => (
                  <label key={o.installments} className="flex items-center gap-3 cursor-pointer text-sm font-bold">
                    <input
                      type="radio"
                      name="parcelas"
                      checked={plano?.installments === o.installments}
                      onChange={() => setQtdRaw(String(o.installments))}
                      className="h-5 w-5 cursor-pointer"
                    />
                    {o.installments}x de {fmt(o.installmentValue)}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={actionsRow}>
        <button type="button" onClick={onBack} className={btnSecondary}>Cancelar</button>
        <button
          type="button"
          disabled={!plano || loading || !!loadError}
          onClick={() => { setTermsAccepted(false); setContractError(''); setView('proposta'); }}
          className={btnPrimary}
        >
          Simular
        </button>
      </div>
    </div>
  );

  const renderProposta = () => {
    if (!plano || amount === null) return null;
    const iofAd = plano.iofAdicional ?? 0;
    const principal = plano.saldoFinanciado !== undefined ? plano.saldoFinanciado - plano.iof - iofAd : plano.totalAmount - plano.iof - plano.juros;
    const composicao: [string, number][] = [
      ['Valor Principal', principal],
      ['IOF', plano.iof],
      ...(iofAd > 0 ? ([['IOF adicional', iofAd]] as [string, number][]) : []),
      ['Juros', plano.juros],
    ];
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <Heading>Proposta</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 pt-2">
            <div>
              <Line label="Quantidade de Parcelas" value={`${plano.installments}x`} />
              <Line label="Valor da parcela" value={fmt(plano.installmentValue)} />
              <Line label="Tipo de parcelamento" value={cfg.tipo} />
              <Line label="Valor total a pagar" value={fmt(plano.totalAmount)} />
              {plano.cetAnual !== undefined && (
                <Line label="CET - Custo efetivo total" value={`${pct(mensalDeAnual(plano.cetAnual))} a.m. | ${pct(plano.cetAnual)} a.a.`} />
              )}
            </div>
            <div>
              <Line label="Valor total da dívida" value={fmt(amount)} />
              <Line label="Valor da entrada" value={fmt(entrada)} />
              <Line label="Valor total a parcelar" value={fmt(Math.max(0, amount - entrada))} />
              <Line label="Taxa de Juros" value={`${pct(taxaMensal)} a.m. | ${pct(anual(taxaMensal))} a.a.`} />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Heading>Composição CET (Custo Efetivo Total)</Heading>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 sm:gap-x-12 gap-y-2 pt-2 text-sm">
            <span />
            <span className={`text-[10px] font-black uppercase tracking-wider text-right ${muted}`}>Valor</span>
            <span className={`text-[10px] font-black uppercase tracking-wider text-right ${muted}`}>Percentual</span>
            {composicao.map(([label, valor]) => (
              <React.Fragment key={label}>
                <span className="font-bold">{label}</span>
                <span className="font-black text-right">{fmt(valor)}</span>
                <span className={`font-bold text-right ${muted}`}>{pct(valor / plano.totalAmount)}</span>
              </React.Fragment>
            ))}
            <span className="font-black">Valor Total a pagar</span>
            <span className="font-black text-right">{fmt(plano.totalAmount)}</span>
            <span className="font-black text-right">100,00%</span>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <p className={`flex items-start gap-2 text-xs font-bold ${muted}`}>
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            O limite do cartão será liberado de acordo com o pagamento das parcelas.
            {entrada > 0 && ` A entrada de ${fmt(entrada)} é lançada na fatura aberta.`}
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} className="mt-0.5 h-5 w-5 cursor-pointer" />
            <span className="text-xs font-bold">Li e aceito os termos e condições. Ao concluir, a proposta de {cfg.tipo.toUpperCase()} será criada.</span>
          </label>
          {contractError && <p className="text-xs font-bold text-rose-400">{contractError}</p>}
        </section>

        <div className={actionsRow}>
          <button type="button" onClick={() => setView('simulacao')} className={btnSecondary}>Voltar</button>
          <button type="button" disabled={!termsAccepted} onClick={() => setPinOpen(true)} className={btnPrimary}>Concluir Proposta</button>
        </div>
      </div>
    );
  };

  const renderConcluido = () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 py-6">
        <CheckCircle2 size={56} className={isMidnight ? 'text-volt-green' : 'text-emerald-600'} />
        <p className="text-xl font-black">Contratação realizada</p>
        <p className={`text-xs font-bold ${muted}`}>Confira os detalhes abaixo.</p>
      </div>
      {receipt && (
        <section className="flex flex-col gap-2 max-w-xl w-full mx-auto">
          <Heading>Detalhes da contratação</Heading>
          <Line label="Produto" value={cfg.tipo} />
          <Line label="Parcelamento" value={`${receipt.installments}x de ${fmt(receipt.installmentValue)}`} />
          <Line label="Valor total a pagar" value={fmt(receipt.totalAmount)} />
          <Line label="IOF" value={fmt(receipt.iof)} />
          <Line label="Juros" value={fmt(receipt.juros)} />
          {receipt.firstDueDate && <Line label="Data da 1ª parcela" value={new Date(receipt.firstDueDate).toLocaleDateString('pt-BR')} />}
        </section>
      )}
      <div className={actionsRow}>
        <button type="button" onClick={() => onFinish(false)} className={btnSecondary}>Fechar</button>
        <button type="button" onClick={() => onFinish(true)} className={btnPrimary}>Ver meus parcelamentos</button>
      </div>
    </div>
  );

  const cartaoFinal = user?.creditCard?.number ? String(user.creditCard.number).slice(-4) : '';

  return (
    <div className={`min-h-screen ${pageBg} ${isMidnight ? 'text-on-surface' : 'text-black'} font-sans`}>
      <div className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Voltar" onClick={view === 'concluido' ? () => onFinish(false) : onBack} className={`p-2 rounded-full ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-black">Simulação de parcelamento</h2>
          </div>
          {cartaoFinal && <span className={`text-xs font-bold ${muted}`}>Cartão final {cartaoFinal}</span>}
        </header>

        <div role="tablist" className={`flex flex-wrap gap-2 border-b pb-3 ${rule}`}>
          {(['pf', 'reneg'] as const).map((p) => {
            const ativo = product === p;
            const bloqueado = (p === 'reneg' && !renegElegivel) || (view !== 'simulacao' && !ativo);
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={ativo}
                disabled={bloqueado}
                onClick={() => trocarProduto(p)}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                  ativo ? (isMidnight ? 'bg-volt-green text-black' : 'bg-black text-white') : isMidnight ? 'border border-white/20 hover:bg-white/10' : 'border-2 border-black/40 hover:bg-black/5'
                }`}
              >
                {CONFIG[p].aba}
              </button>
            );
          })}
          {!renegElegivel && <span className={`self-center text-[10px] font-bold ${muted}`}>Renegociação disponível só para conta bloqueada ou na lista negra.</span>}
        </div>

        {progresso}
        {view === 'simulacao' ? renderSimulacao() : view === 'proposta' ? renderProposta() : renderConcluido()}
      </div>

      {renegOfferOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal="true" aria-labelledby="reneg-offer-title">
          <div className={`w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 ${isMidnight ? 'bg-volt-surface border border-white/10 text-on-surface' : 'bg-white border-2 border-black text-black'}`}>
            <h3 id="reneg-offer-title" className="text-lg font-black">Você pode renegociar sua dívida</h3>
            <p className={`text-sm font-bold ${muted}`}>
              Sua conta está {user?.creditCard?.isBlacklisted ? 'na lista negra' : 'bloqueada'} por atraso. Na Renegociação você
              consolida faturas e encargos em até {CONFIG.reneg.max}x, com taxa de {pct(CONFIG.reneg.taxaPadrao)} a.m., menor que a do
              Parcelamento de Fatura, e o cartão é liberado ao contratar.
            </p>
            <div className={actionsRow}>
              <button type="button" onClick={() => setRenegOfferOpen(false)} className={btnSecondary}>Continuar no parcelamento</button>
              <button type="button" onClick={() => { setRenegOfferOpen(false); trocarProduto('reneg'); }} className={btnPrimary}>Simular renegociação</button>
            </div>
          </div>
        </div>
      )}

      {pinOpen && (
        <PasswordModal
          isOpen={pinOpen}
          onClose={() => setPinOpen(false)}
          onConfirm={handleConfirmPin}
          title={`Confirmar ${cfg.tipo}`}
          description={plano ? `Digite seu PIN para contratar ${plano.installments}x de ${fmt(plano.installmentValue)}.` : 'Digite seu PIN para confirmar.'}
          isLoading={submitting}
        />
      )}
    </div>
  );
}

export default InstallmentContractAllureView;
