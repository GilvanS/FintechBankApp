/**
 * Exportação em CSV da massa gerada pelo Massas 3.0 (Admin), pra alimentar planilha de teste
 * igual ao padrão TBL_CADASTRO/TBL_CENARIOS do CMS (gerador-massa-unificado).
 *
 * Só entram no CSV campos que o operador de fato controla/seleciona na tela e que são enviados
 * com sucesso pra API (mesmo formato de `montarPayload()` em MainMassCreatorFlow.tsx) — número,
 * CVV e validade do cartão são sorteio só pro mockup visual, nunca persistem, não entram aqui.
 */
import { GeneratedMassData, OVERDUE_TIERS } from './massGenerator';

/** Senha fixa de todo usuário criado pelo Massas 3.0 — mantida assim enquanto o projeto está em fase de testes. */
export const SENHA_PADRAO_TESTES = 'admin999';

/**
 * E-mail corporativo: nome.sobrenome@fintech.com. Mesma técnica de `MainMassCreatorFlow.tsx`
 * (normaliza NFD pra tirar acento, já que massas estrangeiras trazem nomes não-ASCII).
 */
export function buildEmail(fullName: string): string {
    const partes = fullName
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!partes.length) return 'massa@fintech.com';
    const nome = partes[0];
    const sobrenome = partes.length > 1 ? partes[partes.length - 1] : '';
    return sobrenome ? `${nome}.${sobrenome}@fintech.com` : `${nome}@fintech.com`;
}

export const CSV_COLUNAS = [
    // CADASTRO — único bloco que alimenta o form real de aquisição (SignUp.tsx)
    'NOME_COMPLETO', 'EMAIL', 'CPF', 'SENHA',
    // PERFIL
    'DATA_NASCIMENTO', 'IDADE', 'PAIS',
    // ENDERECO
    'CEP', 'RUA', 'NUMERO', 'BAIRRO', 'CIDADE', 'ESTADO',
    // CARTAO — só os 4 campos que o operador seleciona na tela + o limite
    'BANDEIRA_CARTAO', 'DIA_VENCIMENTO', 'TIPO_CARTAO', 'ATIVACAO_CARTAO', 'LIMITE_CARTAO',
    // CENARIO — estado pós-provisionamento, pro step de login/dashboard/fatura
    'SALDO', 'LIMITE_PIX_DIARIO', 'STATUS_ATRASO', 'DIAS_ATRASO', 'VALOR_FATURA_ATRASO',
] as const;

const CSV_HEADER = CSV_COLUNAS.join(';');

/** Escapa campo no formato Excel-safe (`="valor"`), evitando notação científica em CPF/telefone/CEP. */
export function formatCsvField(valor: unknown): string {
    if (valor === null || valor === undefined) return '=""';
    return `="${String(valor).replace(/"/g, '""')}"`;
}

export function montarColunasCsv(dados: GeneratedMassData): (string | number)[] {
    const emAtraso = dados.overdueState !== 'EM_DIA';
    const tier = emAtraso ? OVERDUE_TIERS[dados.overdueState as Exclude<typeof dados.overdueState, 'EM_DIA'>] : null;

    return [
        dados.fullName,
        buildEmail(dados.fullName),
        dados.cpf.replace(/\D/g, ''),
        SENHA_PADRAO_TESTES,
        dados.birthDate,
        dados.age,
        dados.countryOrigin,
        dados.address.cep,
        dados.address.street,
        dados.address.number,
        dados.address.neighborhood,
        dados.address.city,
        dados.address.state,
        dados.creditCard.brand,
        dados.creditCard.dueDay,
        dados.creditCard.cardType,
        dados.creditCard.activationState,
        dados.creditCard.limit,
        dados.balance,
        dados.dailyPixLimit,
        emAtraso ? 'inadimplente' : 'adimplente',
        tier ? tier.days : 0,
        tier ? tier.amount : 0,
    ];
}

export function gerarLinhaCsv(dados: GeneratedMassData): string {
    return montarColunasCsv(dados).map(formatCsvField).join(';');
}

/** Monta o CSV completo (header + linhas) a partir de uma lista de massas já criadas com sucesso. */
export function gerarCsv(listaDados: GeneratedMassData[]): string {
    const linhas = listaDados.map(gerarLinhaCsv);
    return [CSV_HEADER, ...linhas].join('\n') + '\n';
}

/** Inverso de `formatCsvField` — desfaz o escape `="valor""com""aspas"` de volta pro texto original. */
export function limparValorCsv(valor: string): string {
    if (valor.startsWith('="') && valor.endsWith('"')) {
        return valor.slice(2, -1).replace(/""/g, '"');
    }
    return valor;
}

/**
 * Extrai os CPFs já presentes num CSV existente (ex.: texto de um export anterior, colado ou
 * importado via <input type="file">) — o browser não tem `fs` pra reler um arquivo em disco
 * sozinho, então quem chama essa função precisa entregar o conteúdo já lido como string.
 * Usado pra evitar gerar um CPF/usuário duplicado ao continuar um lote em sessões diferentes,
 * mesma ideia de `carregarContagensDeArquivoExistente` do gerador-massa-unificado (CMS).
 */
export function extrairCpfsExistentes(csvTexto: string): Set<string> {
    const linhas = csvTexto.split(/\r?\n/).filter((l) => l.length > 0);
    const [headerLine, ...dataLines] = linhas;
    if (!headerLine) return new Set();

    const indiceCpf = headerLine.split(';').indexOf('CPF');
    if (indiceCpf === -1) return new Set();

    const cpfs = new Set<string>();
    for (const linha of dataLines) {
        const colunas = linha.split(';');
        if (colunas.length <= indiceCpf) continue;
        cpfs.add(limparValorCsv(colunas[indiceCpf]));
    }
    return cpfs;
}
