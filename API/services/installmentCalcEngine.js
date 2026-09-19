/**
 * services/installmentCalcEngine.js
 *
 * Motor de cálculo de Parcelamento de Fatura (PF), fiel à planilha de referência
 * "CALCULO DE PF_RENEG_V1.xlsm" (abas PF / IOF 1 / IOF 2). Função pura — sem I/O,
 * sem dependência de banco — pra poder validar linha a linha contra a planilha antes
 * de integrar no motor de billing.
 */

const IOF_MENSAL_RATE = 0.00246; // 0,246% a.m. — aplicado dia a dia: (taxa/30) * dias
const IOF_ADICIONAL_RATE = 0.0038; // 0,38% fixo, sobre o principal já líquido de saldo antigo

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

const TIPOS_ENTRADA = Object.freeze({
  SEM_ENTRADA: 'SEM ENTRADA',
  ENTRADA_IGUAL: 'ENTRADA IGUAL AS DEMAIS PARCELAS',
  ENTRADA_DIFERENTE: 'ENTRADA DIFERENTE DAS DEMAIS PARCELAS',
});

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function toExcelSerial(date) {
  return Math.round((date.getTime() - EXCEL_EPOCH_MS) / MS_PER_DAY);
}

function fromExcelSerial(serial) {
  return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY);
}

function toSerial(input) {
  if (typeof input === 'number') return input;
  if (input instanceof Date) return toExcelSerial(input);
  throw new TypeError('Data inválida: use excel serial (number) ou Date');
}

function excelDATE(year, month1based, day) {
  // Replica DATE() do Excel: estouro de mês/dia normaliza pro calendário seguinte,
  // igual o overflow nativo de Date.UTC — não precisa de tratamento especial aqui.
  return toExcelSerial(new Date(Date.UTC(year, month1based - 1, day)));
}

function serialParts(serial) {
  const d = fromExcelSerial(serial);
  return { year: d.getUTCFullYear(), month1: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Vencimento da parcela seguinte (replica PF!B40 em diante): mantém o dia fixo
 * `diaVencimento` todo mês, avançando pro mês seguinte quando o dia da parcela anterior
 * já passou do dia de vencimento.
 *
 * O guard-clause de borda (mês curto/fevereiro) é copiado literalmente da fórmula original,
 * incluindo sua falha conhecida: o IF interno da planilha ficou sem ramo "senão" (só cobre o
 * caso em que DATE() estoura pro dia 2, não todos os casos de mês curto). Fica assim de
 * propósito pra bater exatamente com a planilha — não "corrigir" aqui.
 */
function nextDueDateSerial(prevSerial, diaVencimento) {
  const { year, month1, day } = serialParts(prevSerial);
  const targetMonth1 = day < diaVencimento ? month1 : month1 + 1;
  const candidate = excelDATE(year, targetMonth1, diaVencimento);

  const guardMonth1 = day < diaVencimento ? targetMonth1 + 1 : 0; // IF(cond, val) sem else, igual ao original
  const candidate2 = excelDATE(year, guardMonth1, diaVencimento);
  const adj = (serialParts(candidate).day !== diaVencimento && serialParts(candidate2).day === 2) ? -1 : 0;

  return candidate + adj;
}

/**
 * Datas de vencimento das parcelas. Índice 0 = data de origem (base de desconto/juros),
 * índices 1..prazo = vencimento de cada parcela.
 *
 * Quando o tipo é "ENTRADA IGUAL AS DEMAIS PARCELAS", a 1ª parcela cai direto na "Data
 * Limite para Pgto" (entrada paga junto com o vencimento atual da fatura) e a 2ª cai no
 * "Vencimento Próximo Corte"; da 3ª em diante, dia fixo `diaVencimento` todo mês.
 * Nos outros dois tipos (SEM ENTRADA / DIFERENTE), não há essa antecipação: a 1ª parcela
 * já cai no "Vencimento Próximo Corte", e da 2ª em diante, dia fixo `diaVencimento`.
 */
function buildDueDates({ dataLimitePagamento, vencimentoProximoCorte, diaVencimento, tipoEntrada, prazo }) {
  const origem = toSerial(dataLimitePagamento);
  const corte = toSerial(vencimentoProximoCorte);
  const isEntradaIgual = tipoEntrada === TIPOS_ENTRADA.ENTRADA_IGUAL;

  const dates = [origem];
  if (prazo >= 1) dates.push(isEntradaIgual ? origem : corte);
  if (prazo >= 2) dates.push(isEntradaIgual ? corte : nextDueDateSerial(dates[1], diaVencimento));
  for (let n = 3; n <= prazo; n++) {
    dates.push(nextDueDateSerial(dates[n - 1], diaVencimento));
  }
  return dates;
}

/**
 * Tabela de amortização completa pro `principal` informado, nas datas dadas.
 * A parcela (PMT) é constante: principal / soma dos fatores de desconto calculados dia a dia
 * a partir da data de origem — não meses fixos de 30 dias. É por isso que uma fórmula Price
 * de livro-texto não bate com os valores reais da planilha.
 */
function runAmortization(principal, taxaMensal, dates) {
  const prazo = dates.length - 1;
  const origem = dates[0];

  const discountFactors = [];
  for (let n = 1; n <= prazo; n++) {
    const days = dates[n] - origem;
    const factor = 1 / Math.pow(1 + taxaMensal, days / 30);
    discountFactors.push(Math.round(factor * 1e8) / 1e8);
  }
  const sumDiscount = discountFactors.reduce((a, b) => a + b, 0);
  const pmt = round2(principal / sumDiscount);

  const rows = [];
  let saldo = principal;
  let saldoPrincipal = principal;
  let sumJuros = 0;
  let sumPrincipal = 0;
  let sumIofAux = 0;

  for (let n = 1; n <= prazo; n++) {
    const diasPeriodo = dates[n] - dates[n - 1];
    const juros = round2((Math.pow(1 + taxaMensal, diasPeriodo / 30) - 1) * saldo);
    const saldoAtual = saldo + juros - pmt;
    const saldoPrincipalAtual = Math.min(principal, saldoAtual, saldoPrincipal);
    const principalAmortizado = saldoPrincipal - saldoPrincipalAtual;
    const pagamentoJuros = Math.min(pmt - principalAmortizado, pmt);
    const diasDesdeOrigem = Math.min(365, dates[n] - origem);
    const iofAux = round2(((principalAmortizado * IOF_MENSAL_RATE) / 30) * diasDesdeOrigem);

    rows.push({
      parcela: n,
      dataVencimento: fromExcelSerial(dates[n]),
      saldo: saldoAtual,
      saldoPrincipal: saldoPrincipalAtual,
      principal: principalAmortizado,
      juros,
      pagamentoJuros,
      pmt,
      diasCobrados: diasPeriodo,
      iofAux,
      fatorDesconto: discountFactors[n - 1],
    });

    sumJuros += juros;
    sumPrincipal += principalAmortizado;
    sumIofAux += iofAux;
    saldo = saldoAtual;
    saldoPrincipal = saldoPrincipalAtual;
  }

  return {
    pmt,
    sumDiscount,
    sumJuros: round2(sumJuros),
    sumPrincipal: round2(sumPrincipal),
    sumIofAux: round2(sumIofAux),
    rows,
  };
}

/**
 * XIRR (TIR com datas irregulares, convenção /365) — mesma função usada em PF!C33 pro CET.
 * Newton-Raphson com fallback de bisseção pra garantir convergência em taxas altas.
 */
function xirr(cashflows, dateSerials, guess = 0.1) {
  const origem = dateSerials[0];
  const years = dateSerials.map((d) => (d - origem) / 365);

  const npv = (rate) => cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, years[i]), 0);
  const dnpv = (rate) => cashflows.reduce((sum, cf, i) => sum - (years[i] * cf) / Math.pow(1 + rate, years[i] + 1), 0);

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (Math.abs(df) < 1e-12) break;
    const next = rate - f / df;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }

  let lo = -0.99;
  let hi = 10;
  let fLo = npv(lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
  }
  return (lo + hi) / 2;
}

/**
 * Parcelamento de Fatura (PF) — motor principal, fiel à aba 'PF' da planilha de referência.
 *
 * O IOF é calculado em 2 passadas, igual às abas 'IOF 1'/'IOF 2': a 1ª passada tributa o
 * principal "limpo" (fatura + seguro, líquida de entrada quando "DIFERENTE"); a 2ª embute o
 * IOF da 1ª passada no principal e recalcula — o saldo financiado final usa sempre o valor
 * da 2ª passada (o IOF sobre o IOF financiado).
 */
function calcularParcelamentoFatura(params) {
  const {
    valorFatura,
    saldoAbertoAnterior = 0,
    taxaMensal,
    prazo,
    tipoEntrada,
    novaEntrada = 0,
    dataLimitePagamento,
    vencimentoProximoCorte,
    diaVencimento,
    temSeguro = false,
    valorSeguro = 0,
  } = params;

  if (!Object.values(TIPOS_ENTRADA).includes(tipoEntrada)) {
    throw new Error(`tipoEntrada inválido: ${tipoEntrada}`);
  }

  const auxProducao = tipoEntrada === TIPOS_ENTRADA.ENTRADA_DIFERENTE
    ? valorFatura - novaEntrada
    : valorFatura;
  const seguro = temSeguro ? round2(valorSeguro) : 0;
  const principalSeed = auxProducao + seguro;

  const pagamentoEntrada = tipoEntrada === TIPOS_ENTRADA.ENTRADA_DIFERENTE ? novaEntrada : 0;
  const saldoADescontar = Math.max(saldoAbertoAnterior - pagamentoEntrada, 0);

  const dates = buildDueDates({ dataLimitePagamento, vencimentoProximoCorte, diaVencimento, tipoEntrada, prazo });

  // Math.max(...,0): a fórmula original da planilha ('IOF 2'!C18) não trava esse piso —
  // só não bateu em cenário real porque saldoADescontar nunca chegou perto do principal
  // no exemplo validado. Sem o clamp, saldoAbertoAnterior grande (herdado) rende IOF
  // Adicional negativo, o que não existe na prática (IOF não é crédito).
  const pass1 = runAmortization(principalSeed, taxaMensal, dates);
  const iof1 = pass1.sumIofAux;
  const iofAdicional1 = Math.max(0, round2((principalSeed - saldoADescontar) * IOF_ADICIONAL_RATE));

  const principalPass2 = principalSeed + iof1 + iofAdicional1;
  const pass2 = runAmortization(principalPass2, taxaMensal, dates);
  const iof2 = pass2.sumIofAux;
  const iofAdicional2 = Math.max(0, round2((principalPass2 - saldoADescontar) * IOF_ADICIONAL_RATE));

  const saldoFinanciado = round2(principalSeed + iof2 + iofAdicional2);
  const final = runAmortization(saldoFinanciado, taxaMensal, dates);

  const cashflows = [-valorFatura, ...final.rows.map((r) => r.pmt)];
  const cetAnual = xirr(cashflows, dates);

  return {
    valorParcela: final.pmt,
    saldoFinanciado,
    iofTotal: iof2,
    iofAdicional: iofAdicional2,
    seguro,
    cetAnual,
    totalJuros: final.sumJuros,
    totalAPagar: round2(final.pmt * prazo),
    tabelaAmortizacao: final.rows,
  };
}

/**
 * Parcelamento Automático (PA) — mesmo motor da PF (validado contra "CALCULO DE
 * PF_RENEG_V1_PA.xlsm": fatura 4391.81, saldo aberto 2000, entrada 494.14, taxa 8,95%,
 * 10x — bate exato com PMT, IOF, IOF Adicional, saldo financiado e CET da planilha).
 *
 * O PA não é um motor separado: é a aba 'PF' com taxa 8,95%, prazo fixo em 10x, e
 * `tipoEntrada = ENTRADA DIFERENTE DAS DEMAIS PARCELAS`, onde a "Nova Entrada" É o valor
 * que o cliente pagou da fatura em atraso (`valorPagamento`). `saldoAbertoAnterior` é o
 * valor herdado da fatura anterior (encargos já embutidos no "mínimo" — a checagem de que
 * `valorPagamento` está entre 10% e o mínimo, exclusive, é regra de elegibilidade e fica
 * fora daqui, em services/billingValidation.js).
 */
function calcularParcelamentoAutomatico(params) {
  const {
    valorFatura,
    valorPagamento,
    saldoAbertoAnterior = 0,
    dataLimitePagamento,
    vencimentoProximoCorte,
    diaVencimento,
  } = params;

  return calcularParcelamentoFatura({
    valorFatura,
    saldoAbertoAnterior,
    taxaMensal: 0.0895,
    prazo: 10,
    tipoEntrada: TIPOS_ENTRADA.ENTRADA_DIFERENTE,
    novaEntrada: valorPagamento,
    dataLimitePagamento,
    vencimentoProximoCorte,
    diaVencimento,
  });
}

/**
 * Elegibilidade de valor pro Parcelamento Automático (PA): o cliente precisa ter pago um
 * valor ENTRE o piso (10% do mínimo) e o próprio mínimo — exclusive nas duas pontas.
 *
 * `minimo` reusa o mesmo cálculo que já existe pro "pagamento mínimo" padrão
 * (billingValidation.js: `valorTotal * 0.10`) — o `valorTotal` ali já carrega os encargos
 * herdados de fatura anterior via o motor de acúmulo diário, então não precisa de fórmula
 * nova aqui, só a faixa. A checagem de dias em atraso (30-44d) é feita à parte, em
 * billingValidation.js (`willParcelamentoElegivel`).
 */
function checarElegibilidadePA({ valorTotal, valorPago }) {
  const minimo = round2(valorTotal * 0.10);
  const piso = round2(minimo * 0.10);
  const elegivel = valorPago > piso && valorPago < minimo;
  return { minimo, piso, elegivel };
}

module.exports = {
  calcularParcelamentoFatura,
  calcularParcelamentoAutomatico,
  checarElegibilidadePA,
  TIPOS_ENTRADA,
  // exportados só pra teste/validação isolada contra a planilha
  runAmortization,
  buildDueDates,
  nextDueDateSerial,
  xirr,
  toExcelSerial,
  fromExcelSerial,
};
