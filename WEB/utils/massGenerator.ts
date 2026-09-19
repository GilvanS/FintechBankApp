/**
 * Motor 360° Global de Geração de Dados Fictícios de Massa (Mass Generator Engine).
 * Gera nomes, CPFs válidos (com algoritmo DV), endereços completos e dados de cartão
 * para qualquer país do mundo (Américas, Europa, Ásia, Oriente Médio, África, Oceania),
 * garantindo transliteração limpa para o alfabeto latino/PT-BR/US em codificação UTF-8.
 */

export interface GeneratedMassData {
    fullName: string;
    cpf: string;
    birthDate: string;
    age: number;
    hasTutor: boolean;
    tutor?: {
        fullName: string;
        cpf: string;
        relationship: string;
    };
    countryOrigin: string;
    address: {
        cep: string;
        street: string;
        number: string;
        complement?: string;
        neighborhood: string;
        city: string;
        state: string;
    };
    creditCard: {
        brand: 'MASTERCARD' | 'VISA' | 'ELO' | 'AMEX' | 'HIPERCARD';
        cardNumber: string;
        cardNumberMasked: string;
        cvv: string;
        expirationDate: string;
        dueDay: number;
        cardType: 'PHYSICAL' | 'VIRTUAL' | 'BOTH';
        activationState: 'ACTIVATED' | 'AWAITING_ACTIVATION';
        limit: number;
    };
    balance: number;
    dailyPixLimit: number;
    overdueState: OverdueState;
}

export type OverdueState = 'EM_DIA' | 'EM_ATRASO_7D' | 'EM_ATRASO_15D' | 'EM_ATRASO_30D';

/** Estado de um ciclo de fatura do Gerador de Massa 4.0 (histórico de 1 a 6 ciclos encadeados). */
export type CycleStatus = 'adimplente' | 'inadimplente';
export const MAX_MASS_CYCLES = 6;
export const MIN_MASS_CYCLES = 1;

const MESES_CURTOS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Vencimento REAL mais recente que já passou para um dado dia-do-mês — espelho de
 * `computeLastPassedDueDate` (API/repositories/usersRepo.js), usado pelo backend para
 * ancorar cada fatura FECHADA da massa. Mantido igual para a UI não divergir do gerador.
 */
/** Mesmo dia-do-mês `k` meses antes/depois, sem overflow (dueDay 31 em fevereiro => 28/29). */
export function shiftMonthsSameDay(date: Date, k: number, dueDay: number): Date {
    const y = date.getFullYear();
    const m = date.getMonth() + k;
    const lastDay = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(dueDay, lastDay), 12, 0, 0);
}

/**
 * `minDaysPassed`: garante ao menos N dias de atraso, recuando mês a mês. Usado pro
 * ciclo ATUAL inadimplente (piso 7d; tier pode pedir 15d/30d) — fatura que venceu
 * hoje ou há 2 dias não nasce como inadimplente.
 */
export function computeLastPassedDueDate(dueDay: number, referenceDate: Date = new Date(), minDaysPassed = 0): Date {
    let d = shiftMonthsSameDay(referenceDate, 0, dueDay);
    if (d > referenceDate) d = shiftMonthsSameDay(d, -1, dueDay);
    if (minDaysPassed > 0) {
        const limite = new Date(referenceDate);
        limite.setDate(limite.getDate() - minDaysPassed);
        let guard = 0;
        while (d > limite && guard++ < 24) d = shiftMonthsSameDay(d, -1, dueDay);
    }
    return d;
}

/**
 * Datas de vencimento dos N ciclos (mais antigo primeiro), exatamente como o
 * `seedMassBilling` gera: a âncora é o vencimento do ciclo ATUAL (com o atraso mínimo
 * quando inadimplente) e cada ciclo anterior recua 1 mês no mesmo dueDay.
 */
export function computeCycleDueDates(count: number, dueDay: number, now: Date = new Date(), minDaysOverdue = 0): Date[] {
    const base = new Date(now);
    base.setHours(12, 0, 0, 0);
    const anchor = computeLastPassedDueDate(dueDay, base, minDaysOverdue);
    return Array.from({ length: count }, (_, idx) => shiftMonthsSameDay(anchor, -(count - 1 - idx), dueDay));
}

/** Dias de atraso do ciclo atual inadimplente, como o backend vai gravar (mínimo 1). */
export function computeCurrentCycleOverdueDays(dueDay: number, minDaysOverdue: number, now: Date = new Date()): number {
    const base = new Date(now);
    base.setHours(12, 0, 0, 0);
    return overdueDaysFrom(computeCycleDueDates(1, dueDay, base, minDaysOverdue)[0], base);
}

/** Dias de atraso de um vencimento em relação à referência (mínimo 1, como o backend grava). */
export function overdueDaysFrom(due: Date, now: Date = new Date()): number {
    const base = new Date(now);
    base.setHours(12, 0, 0, 0);
    return Math.max(1, Math.round((base.getTime() - due.getTime()) / 86400000));
}

/**
 * Rótulos de calendário dos ciclos: `atual (set)`, `-1m (ago)`, `-2m (jul)`...
 * O mês é o do vencimento real — com dueDay ainda por vir neste mês (ou com atraso
 * mínimo não atingido), o ciclo "atual" cai no mês anterior.
 */
export function getCycleLabels(count: number, dueDay: number, now: Date = new Date(), minDaysOverdue = 0): string[] {
    return computeCycleDueDates(count, dueDay, now, minDaysOverdue).map((due, idx) => {
        const mes = MESES_CURTOS_PT[due.getMonth()];
        const offset = count - 1 - idx;
        return offset === 0 ? `atual (${mes})` : `-${offset}m (${mes})`;
    });
}

/**
 * Sorteia um histórico de 1-6 ciclos (adimplente/inadimplente por ciclo) e um estado
 * de conta coerente com o ciclo ATUAL: inadimplente => tier aleatório (7/15/30d),
 * adimplente => EM_DIA. Usado pelo botão "Gerar Aleatório" do gerador.
 */
export function generateRandomCycleHistory(): { cycles: CycleStatus[]; overdueState: OverdueState } {
    const count = MIN_MASS_CYCLES + Math.floor(Math.random() * (MAX_MASS_CYCLES - MIN_MASS_CYCLES + 1));
    const cycles: CycleStatus[] = Array.from({ length: count }, () => (Math.random() < 0.5 ? 'adimplente' : 'inadimplente'));
    const atualInadimplente = cycles[cycles.length - 1] === 'inadimplente';
    const overdueState: OverdueState = atualInadimplente
        ? OVERDUE_TIER_KEYS[Math.floor(Math.random() * OVERDUE_TIER_KEYS.length)]
        : 'EM_DIA';
    return { cycles, overdueState };
}

/**
 * Monta o payload de criação de massa garantindo o campo `cycles` (1-6 posições).
 *  - Sem `cycles`: deriva 1 ciclo do `accountStatus` informado (ou 'inadimplente'),
 *    preservando o comportamento atual do gerador.
 *  - `accountStatus` é sempre alinhado ao ÚLTIMO ciclo (estado atual da conta),
 *    para manter compatível o restante do backend que ainda lê esse campo.
 */
export function buildMassPayload<T extends { cycles?: CycleStatus[]; accountStatus?: string }>(
    input: T
): Omit<T, 'cycles' | 'accountStatus'> & { cycles: CycleStatus[]; accountStatus: CycleStatus } {
    const fallback: CycleStatus = input.accountStatus === 'adimplente' ? 'adimplente' : 'inadimplente';
    const cycles: CycleStatus[] = input.cycles && input.cycles.length > 0 ? [...input.cycles] : [fallback];

    if (cycles.length > MAX_MASS_CYCLES) {
        throw new Error(`Máximo de ${MAX_MASS_CYCLES} ciclos de fatura por massa.`);
    }
    const invalido = cycles.find((c) => c !== 'adimplente' && c !== 'inadimplente');
    if (invalido !== undefined) {
        throw new Error(`Ciclo inválido: ${String(invalido)}. Use 'adimplente' ou 'inadimplente'.`);
    }

    return { ...input, cycles, accountStatus: cycles[cycles.length - 1] };
}

/**
 * Cenários de massa EM ATRASO oferecidos pelo gerador. Cada nível define os dias
 * de atraso e o valor (principal) da fatura fechada vencida a ser gerada no PGDB.
 */
export const OVERDUE_TIERS: Record<Exclude<OverdueState, 'EM_DIA'>, { days: number; amount: number; label: string; short: string; desc: string }> = {
    EM_ATRASO_7D: { days: 7, amount: 1250.00, label: 'Atraso Leve (≥7 dias)', short: 'Leve', desc: 'Fatura fechada vencida de R$ 1.250,00 com pelo menos 7 dias de atraso (ancorada no dia de vencimento do cartão)' },
    EM_ATRASO_15D: { days: 15, amount: 3870.86, label: 'Atraso Médio (≥15 dias)', short: 'Médio', desc: 'Fatura fechada vencida de R$ 3.870,86 com pelo menos 15 dias de atraso (ancorada no dia de vencimento do cartão)' },
    EM_ATRASO_30D: { days: 30, amount: 7500.00, label: 'Atraso Grave (≥30 dias)', short: 'Grave', desc: 'Fatura fechada vencida de R$ 7.500,00 com pelo menos 30 dias de atraso (ancorada no dia de vencimento do cartão)' },
};
export const OVERDUE_TIER_KEYS = Object.keys(OVERDUE_TIERS) as Array<Exclude<OverdueState, 'EM_DIA'>>;

/** Piso de dias de atraso do ciclo ATUAL inadimplente — espelho de MIN_DIAS_ATRASO_CICLO_ATUAL (API). */
export const MIN_OVERDUE_DAYS_CURRENT_CYCLE = 7;

/**
 * Normaliza e translitera qualquer string para texto latino UTF-8 limpo sem acentuação corrompida.
 */
export function sanitizeToLatinUtf8(text: string): string {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
        .replace(/[^\w\s.,-]/gi, '') // remove caracteres não-latinos
        .trim();
}

/**
 * Gerador de CPF Brasileiro Válido com cálculo dos 2 dígitos verificadores (DV).
 */
export function generateValidCPF(): string {
    const randomDigits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

    // Primeiro DV
    let sum1 = 0;
    for (let i = 0; i < 9; i++) {
        sum1 += randomDigits[i] * (10 - i);
    }
    let dv1 = 11 - (sum1 % 11);
    if (dv1 >= 10) dv1 = 0;

    // Segundo DV
    const digitsWithDv1 = [...randomDigits, dv1];
    let sum2 = 0;
    for (let i = 0; i < 10; i++) {
        sum2 += digitsWithDv1[i] * (11 - i);
    }
    let dv2 = 11 - (sum2 % 11);
    if (dv2 >= 10) dv2 = 0;

    const raw = [...digitsWithDv1, dv2].join('');
    return raw;
}

/** Formatador de CPF: 000.000.000-00 */
export function formatCpfDisplay(cpf: string): string {
    const clean = cpf.replace(/\D/g, '').padStart(11, '0');
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

const OFFICIAL_BINS: Record<'MASTERCARD' | 'VISA' | 'ELO' | 'AMEX' | 'HIPERCARD', string[]> = {
    MASTERCARD: ['54427460', '53736360', '51854460', '53642660'],
    VISA:       ['45767460', '47660760', '42031060', '44466676'],
    ELO:        ['65050666', '65051960', '65051860', '65052260'],
    AMEX:       ['37828000', '37148000', '34008000', '37878000'],
    HIPERCARD:  ['60628200', '63709500', '63761200', '63759900', '63760900', '63756800']
};

/**
 * Gerador de Cartões de Crédito Realistas por Bandeira com Algoritmo de Luhn e BINs Válidos Oficiais.
 * - AMEX: BINs (37828000, 37148000, 34008000, 37878000), 15 dígitos (formato 4-6-5), CVV 4 dígitos
 * - VISA: BINs (45767460, 47660760, 42031060, 44466676), 16 dígitos (formato 4-4-4-4), CVV 3 dígitos
 * - MASTERCARD: BINs (54427460, 53736360, 51854460, 53642660), 16 dígitos, CVV 3 dígitos
 * - ELO: BINs (65050666, 65051960, 65051860, 65052260), 16 dígitos, CVV 3 dígitos
 * - HIPERCARD: BINs (60628200, 63709500, 63761200, 63759900, 63760900, 63756800), 16 dígitos, CVV 3 dígitos
 */
export function generateValidCardNumber(brand: 'MASTERCARD' | 'VISA' | 'ELO' | 'AMEX' | 'HIPERCARD'): {
    raw: string;
    formatted: string;
    bin: string;
    cvv: string;
} {
    const bins = OFFICIAL_BINS[brand] || OFFICIAL_BINS.MASTERCARD;
    const prefix = bins[Math.floor(Math.random() * bins.length)];
    const length = brand === 'AMEX' ? 15 : 16;
    const cvvLength = brand === 'AMEX' ? 4 : 3;

    // Gerar dígitos randômicos até (length - 1)
    let payload = prefix;
    while (payload.length < length - 1) {
        payload += Math.floor(Math.random() * 10).toString();
    }

    // Algoritmo de Luhn para o último dígito verificador
    let sum = 0;
    let shouldDouble = true;
    for (let i = payload.length - 1; i >= 0; i--) {
        let digit = parseInt(payload.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const raw = payload + checkDigit;

    // Formatação visual padrão da bandeira
    let formatted = raw;
    if (brand === 'AMEX') {
        // Formato Amex: 4-6-5 (ex: 3782 123456 78901)
        formatted = `${raw.slice(0, 4)} ${raw.slice(4, 10)} ${raw.slice(10, 15)}`;
    } else {
        // Formato Padrão: 4-4-4-4
        formatted = raw.replace(/(\d{4})/g, '$1 ').trim();
    }

    // Gerar CVV
    const cvv = Array.from({ length: cvvLength }, () => Math.floor(Math.random() * 10)).join('');

    return { raw, formatted, bin: prefix, cvv };
}

/** Base de Nomes e Endereços Por País (Transliterados e Pró-Sanitizados) */
const GLOBAL_DATASET: Record<string, {
    firstNames: string[];
    lastNames: string[];
    streets: string[];
    neighborhoods: string[];
    cities: string[];
    states: string[];
    ceps: string[];
    tutorNames: string[];
}> = {
    'Brasil': {
        firstNames: ['Lucas', 'Mariana', 'Gabriel', 'Beatriz', 'Matheus', 'Larissa', 'Thiago', 'Camila', 'Bruno', 'Isabela', 'Rodrigo', 'Juliana', 'Felipe', 'Carolina', 'Rafael', 'Amanda', 'Leonardo', 'Fernanda', 'Gustavo', 'Leticia', 'Vinicius', 'Gabriela', 'Diego', 'Patricia', 'Guilherme', 'Vanessa', 'Eduardo', 'Bianca', 'Andre', 'Jessica', 'Renato', 'Priscila', 'Caio', 'Renata', 'Danilo', 'Marcos', 'Aline', 'Fabio', 'Tatiane', 'Alexandre', 'Vivian', 'Leandro', 'Debora', 'Marcelo', 'Sabrina'],
        lastNames: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento', 'Lima', 'Araujo', 'Fernandes', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Ribeiro', 'Alves', 'Monteiro', 'Mendes', 'Barros', 'Freitas', 'Barbosa', 'Pinto', 'Moura', 'Cavalcanti', 'Dias', 'Castro', 'Campos', 'Cardoso', 'Teixeira', 'Vieira', 'Nunes', 'Moreira', 'Borges'],
        streets: ['Avenida Paulista', 'Rua Augusta', 'Avenida Copacabana', 'Rua das Flores', 'Avenida Brigadeiro Faria Lima', 'Avenida Afonso Pena'],
        neighborhoods: ['Bela Vista', 'Consolacao', 'Copacabana', 'Centro', 'Itaim Bibi', 'Savassi'],
        cities: ['Sao Paulo', 'Rio de Janeiro', 'Curitiba', 'Belo Horizonte', 'Porto Alegre', 'Salvador'],
        states: ['SP', 'RJ', 'PR', 'MG', 'RS', 'BA'],
        ceps: ['01310-200', '22070-011', '80010-000', '30130-010', '90010-000', '40020-000'],
        tutorNames: ['Carlos Eduardo Ferreira (Pai)', 'Ana Maria Silva (Mae)', 'Roberto Mendes Oliveira (Tutor Legal)']
    },
    'Estados Unidos': {
        firstNames: ['Alexander', 'Emily', 'Michael', 'Sophia', 'William', 'Olivia', 'James', 'Emma', 'Benjamin', 'Ava', 'Mason', 'Isabella', 'Ethan', 'Mia', 'Daniel', 'Charlotte', 'Matthew', 'Amelia', 'Henry', 'Harper', 'David', 'Evelyn', 'Joseph', 'Abigail', 'Samuel', 'Elizabeth', 'Lucas', 'Victoria', 'Jackson', 'Chloe'],
        lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott'],
        streets: ['Fifth Avenue', 'Broadway Street', 'Ocean Drive', 'Sunset Boulevard', 'Michigan Avenue', 'Peachtree Street'],
        neighborhoods: ['Manhattan', 'South Beach', 'Hollywood', 'Downtown', 'Lincoln Park', 'Midtown'],
        cities: ['Nova York', 'Miami', 'Los Angeles', 'Chicago', 'Atlanta', 'San Francisco'],
        states: ['NY', 'FL', 'CA', 'IL', 'GA', 'CA'],
        ceps: ['10001', '33139', '90028', '60611', '30303', '94102'],
        tutorNames: ['Robert Smith (Father)', 'Jennifer Johnson (Mother)']
    },
    'Japão': {
        firstNames: ['Taro', 'Kenji', 'Yuki', 'Hanako', 'Ren', 'Aoi', 'Haruto', 'Yui', 'Sota', 'Hina', 'Riku', 'Rio', 'Kaito', 'Sakura', 'Daiki', 'Mei', 'Hiroshi', 'Nana', 'Takumi', 'Akari'],
        lastNames: ['Tanaka', 'Sato', 'Takahashi', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Saito', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Yamazaki'],
        streets: ['Avenida Marunouchi', 'Rua Ginza Chuo', 'Avenida Dotonbori', 'Rua Shinjuku-dori', 'Rua Kawaramachi'],
        neighborhoods: ['Chiyoda', 'Chuo-ku', 'Namba', 'Shinjuku', 'Nakagyo-ku'],
        cities: ['Toquio', 'Toquio', 'Osaka', 'Toquio', 'Quioto'],
        states: ['Toquio', 'Toquio', 'Osaka', 'Toquio', 'Quioto'],
        ceps: ['100-0005', '104-0061', '542-0071', '160-0022', '604-8026'],
        tutorNames: ['Hiroshi Tanaka (Pai)', 'Kazuko Sato (Mae)']
    },
    'China': {
        firstNames: ['Wei', 'Ming', 'Xiu Ying', 'Lei', 'Jian', 'Yan', 'Hao', 'Fang', 'Tao', 'Jing', 'Jun', 'Li', 'Peng', 'Na', 'Feng', 'Hui', 'Bo', 'Min', 'Chao', 'Xin'],
        lastNames: ['Li', 'Zhang', 'Wang', 'Chen', 'Liu', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'He', 'Gao', 'Lin', 'Luo'],
        streets: ['Avenida Jianguomen', 'Rua Nanjing East', 'Avenida Huaihai', 'Rua Beijing Road'],
        neighborhoods: ['Chaoyang', 'Huangpu', 'Xuhui', 'Yuexiu'],
        cities: ['Pequim', 'Xangai', 'Xangai', 'Guangzhou'],
        states: ['Pequim', 'Xangai', 'Xangai', 'Guangdong'],
        ceps: ['100004', '200001', '200030', '510000'],
        tutorNames: ['Guowei Li (Pai)', 'Mei Zhang (Mae)']
    },
    'Coreia do Sul': {
        firstNames: ['Minjun', 'Seoyun', 'Jiwoo', 'Dohyun', 'Haewon', 'Joon', 'Yejun', 'Sua', 'Siwoo', 'Jiho', 'Eunwoo', 'Yuna', 'Hyunwoo', 'Minseo', 'Woojin', 'Seojun'],
        lastNames: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Jeon', 'Hong'],
        streets: ['Rua Teheran-ro', 'Avenida Jong-ro', 'Rua Haeundae-ro', 'Avenida Seochodaero'],
        neighborhoods: ['Gangnam', 'Jongno-gu', 'Haeundae', 'Seocho'],
        cities: ['Seul', 'Seul', 'Busan', 'Seul'],
        states: ['Seul', 'Seul', 'Busan', 'Seul'],
        ceps: ['06164', '03154', '48094', '06591'],
        tutorNames: ['Sangwon Kim (Pai)', 'Hyunjae Lee (Mae)']
    },
    'Arábia Saudita': {
        firstNames: ['Tariq', 'Fahad', 'Noura', 'Youssef', 'Khalid', 'Fatima', 'Omar', 'Sarah', 'Abdullah', 'Zainab', 'Mohammed', 'Reem', 'Ali', 'Layla', 'Hamza', 'Haya'],
        lastNames: ['Al-Mansoor', 'Al-Ghamdi', 'Al-Saud', 'Al-Otaibi', 'Al-Zahrani', 'Al-Harbi', 'Al-Shehri', 'Al-Dossari', 'Al-Qahtani', 'Al-Mutairi', 'Al-Anazi', 'Al-Rashid'],
        streets: ['Avenida King Fahd', 'Rua Olaya Main', 'Avenida Tahlia', 'Rua Corniche'],
        neighborhoods: ['Al-Olaya', 'Al-Malaz', 'Al-Hamra', 'Al-Shati'],
        cities: ['Riad', 'Riad', 'Jeda', 'Dammam'],
        states: ['Riad', 'Riad', 'Meca', 'Oriental'],
        ceps: ['12211', '12836', '23212', '32414'],
        tutorNames: ['Sultan Al-Mansoor (Pai)', 'Aisha Al-Ghamdi (Mae)']
    },
    'Portugal': {
        firstNames: ['Joao', 'Beatriz', 'Goncalo', 'Ines', 'Martim', 'Afonso', 'Leonor', 'Rodrigo', 'Matilde', 'Santiago', 'Carolina', 'Tomas', 'Mariana', 'Duarte', 'Francisca', 'Gabriel', 'Margarida', 'Guilherme', 'Maria', 'Alice'],
        lastNames: ['Silva', 'Ferreira', 'Santos', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Jesus', 'Sousa', 'Fernandes', 'Goncalves', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira', 'Pereira'],
        streets: ['Avenida da Liberdade', 'Rua Garrett', 'Avenida dos Aliados', 'Rua de Santa Catarina'],
        neighborhoods: ['Baixa', 'Chiado', 'Santo Ildefonso', 'Cedofeita'],
        cities: ['Lisboa', 'Lisboa', 'Porto', 'Porto'],
        states: ['Lisboa', 'Lisboa', 'Porto', 'Porto'],
        ceps: ['1250-096', '1200-203', '4000-064', '4000-442'],
        tutorNames: ['Antonio Silva (Pai)', 'Maria Ferreira (Mae)']
    },
    'Alemanha': {
        firstNames: ['Maximilian', 'Sophie', 'Lukas', 'Hannah', 'Felix', 'Emma', 'Leon', 'Mia', 'Paul', 'Marie', 'Jonas', 'Lena', 'Elias', 'Laura', 'Niklas', 'Anna', 'Tim', 'Lea', 'Jan', 'Sarah'],
        lastNames: ['Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schaefer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schroeder', 'Neumann', 'Schwarz', 'Zimmermann'],
        streets: ['Kurfuerstendamm', 'Unter den Linden', 'Maximilianstrasse', 'Kaufingerstrasse'],
        neighborhoods: ['Charlottenburg', 'Mitte', 'Altstadt', 'Maxvorstadt'],
        cities: ['Berlim', 'Berlim', 'Munique', 'Munique'],
        states: ['Berlim', 'Berlim', 'Baviera', 'Baviera'],
        ceps: ['10707', '10117', '80539', '80331'],
        tutorNames: ['Klaus Mueller (Vater)', 'Birgit Schmidt (Mutter)']
    },
    'França': {
        firstNames: ['Jean', 'Camille', 'Pierre', 'Chloe', 'Lucas', 'Emma', 'Gabriel', 'Manon', 'Louis', 'Lea', 'Arthur', 'Ines', 'Hugo', 'Sarah', 'Jules', 'Louise', 'Thomas', 'Jade', 'Maxime', 'Zoe'],
        lastNames: ['Dupont', 'Martin', 'Bernard', 'Dubois', 'Laurent', 'Moreau', 'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard', 'Bonnet', 'Vincent', 'Lambert', 'Fontaine'],
        streets: ['Avenue des Champs-Élysées', 'Rue de Rivoli', 'Boulevard Saint-Germain', 'Rue St-Ferréol'],
        neighborhoods: ['8ème Arrondissement', '1er Arrondissement', '6ème Arrondissement', 'Vieux-Port'],
        cities: ['Paris', 'Paris', 'Paris', 'Marselha'],
        states: ['Île-de-France', 'Île-de-France', 'Île-de-France', 'PACA'],
        ceps: ['75008', '75001', '75006', '13001'],
        tutorNames: ['Henri Dupont (Père)', 'Sophie Martin (Mère)']
    },
    'Itália': {
        firstNames: ['Matteo', 'Giulia', 'Alessandro', 'Sofia', 'Leonardo', 'Aurora', 'Lorenzo', 'Alice', 'Francesco', 'Ginevra', 'Mattia', 'Emma', 'Andrea', 'Giorgia', 'Gabriele', 'Beatrice', 'Riccardo', 'Greta', 'Tommaso', 'Vittoria'],
        lastNames: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa', 'Giordano', 'Mancini', 'Rizzo', 'Lombardi', 'Moretti'],
        streets: ['Via del Corso', 'Via Montenapoleone', 'Corso Vittorio Emanuele', 'Via Roma'],
        neighborhoods: ['Centro Storico', 'Quadrilatero della Moda', 'Brera', 'Chiaia'],
        cities: ['Roma', 'Milao', 'Milao', 'Napoles'],
        states: ['Lazio', 'Lombardia', 'Lombardia', 'Campania'],
        ceps: ['00186', '20121', '20122', '80121'],
        tutorNames: ['Marco Rossi (Padre)', 'Elena Russo (Madre)']
    },
    'Argentina': {
        firstNames: ['Joaquin', 'Valentina', 'Mateo', 'Camila', 'Santiago', 'Lucia', 'Agustin', 'Martina', 'Nicolas', 'Sofia', 'Lucas', 'Catalina', 'Tomas', 'Julieta', 'Franco', 'Delfina', 'Ignacio', 'Paula', 'Matias', 'Abril', 'Bruno', 'Mia', 'Facundo', 'Zoe'],
        lastNames: ['Gonzalez', 'Rodriguez', 'Fernandez', 'Lopez', 'Gomez', 'Diaz', 'Martinez', 'Perez', 'Garcia', 'Sanchez', 'Romero', 'Sosa', 'Torres', 'Alvarez', 'Ruiz', 'Ramirez', 'Flores', 'Acosta', 'Benitez', 'Medina', 'Herrera', 'Aguirre', 'Castro'],
        streets: ['Avenida 9 de Julio', 'Avenida Corrientes', 'Calle Florida', 'Avenida Colon'],
        neighborhoods: ['Palermo', 'San Telmo', 'Recoleta', 'Centro'],
        cities: ['Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Cordoba'],
        states: ['CABA', 'CABA', 'CABA', 'Cordoba'],
        ceps: ['C1043', 'C1004', 'C1005', 'X5000'],
        tutorNames: ['Gonzalo Gonzalez (Padre)', 'Lucia Rodriguez (Madre)']
    }
};

const COUNTRIES_LIST = Object.keys(GLOBAL_DATASET);

/** Gera nome completo aleatório a partir de combinação de nomes e sobrenomes */
function generateFullName(country: string): string {
    const dataset = GLOBAL_DATASET[country] || GLOBAL_DATASET['Brasil'];
    if (dataset.firstNames && dataset.lastNames) {
        const first = dataset.firstNames[Math.floor(Math.random() * dataset.firstNames.length)];
        const last1 = dataset.lastNames[Math.floor(Math.random() * dataset.lastNames.length)];
        const hasDouble = ['Brasil', 'Portugal', 'Espanha', 'México', 'Argentina', 'Itália'].includes(country)
            ? Math.random() > 0.35
            : Math.random() > 0.75;
        if (hasDouble) {
            let last2 = dataset.lastNames[Math.floor(Math.random() * dataset.lastNames.length)];
            let attempts = 0;
            while (last2 === last1 && attempts < 5) {
                last2 = dataset.lastNames[Math.floor(Math.random() * dataset.lastNames.length)];
                attempts++;
            }
            return `${first} ${last1} ${last2}`;
        }
        return `${first} ${last1}`;
    }
    return 'Massa Fintech';
}

/**
 * Gera um perfil completo de massa de teste randômica para o país especificado (ou qualquer país do mundo).
 */
export function generateRandomMassData(selectedCountry?: string, forceAgeCondition?: 'normal' | 'under18' | 'over80'): GeneratedMassData {
    const country = (selectedCountry && GLOBAL_DATASET[selectedCountry])
        ? selectedCountry
        : COUNTRIES_LIST[Math.floor(Math.random() * COUNTRIES_LIST.length)];

    const dataset = GLOBAL_DATASET[country] || GLOBAL_DATASET['Brasil'];

    const fullName = generateFullName(country);
    const rawCpf = generateValidCPF();
    const cpf = formatCpfDisplay(rawCpf);

    // Idade sempre entre 18 e 80 (regra de tutor removida)
    const age = Math.floor(Math.random() * 63) + 18; // 18 a 80

    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - age;
    const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

    // Endereço
    const street = dataset.streets[Math.floor(Math.random() * dataset.streets.length)];
    const number = String(Math.floor(Math.random() * 900) + 10);
    const neighborhood = dataset.neighborhoods[Math.floor(Math.random() * dataset.neighborhoods.length)];
    const city = dataset.cities[Math.floor(Math.random() * dataset.cities.length)];
    const state = dataset.states[Math.floor(Math.random() * dataset.states.length)];
    const cep = dataset.ceps[Math.floor(Math.random() * dataset.ceps.length)];

    // Cartão Gerado com BIN e Algoritmo de Luhn Específico por Bandeira
    const brands: ('MASTERCARD' | 'VISA' | 'ELO' | 'AMEX' | 'HIPERCARD')[] = ['MASTERCARD', 'VISA', 'ELO', 'AMEX', 'HIPERCARD'];
    const brand = brands[Math.floor(Math.random() * brands.length)];
    const dueDay = Math.floor(Math.random() * 28) + 1;
    const cardTypes: ('PHYSICAL' | 'VIRTUAL' | 'BOTH')[] = ['PHYSICAL', 'VIRTUAL', 'BOTH'];
    const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];

    const cardGen = generateValidCardNumber(brand);
    const last4 = cardGen.raw.slice(-4);
    const cardNumberMasked = brand === 'AMEX' ? `•••• •••••• •${last4}` : `•••• •••• •••• ${last4}`;

    const balance = Math.round((Math.random() * 15000 + 500) * 100) / 100;
    const limit = Math.round((Math.random() * 20000 + 2000) * 100) / 100;
    const dailyPixLimit = Math.round((Math.random() * 5000 + 1000) * 100) / 100;

    // Validade randômica (MM/AA, 3–6 anos no futuro)
    const expMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const expYear = String((currentYear + 3 + Math.floor(Math.random() * 4)) % 100).padStart(2, '0');
    const expirationDate = `${expMonth}/${expYear}`;

    // Estado randômico: apenas Adimplente (EM_DIA) ou Inadimplente (cenário padrão 15d)
    const overdueState: OverdueState = Math.random() > 0.5 ? 'EM_DIA' : 'EM_ATRASO_15D';

    return {
        fullName: sanitizeToLatinUtf8(fullName),
        cpf,
        birthDate,
        age,
        hasTutor: false,
        tutor: undefined,
        countryOrigin: country,
        address: {
            cep,
            street: sanitizeToLatinUtf8(street),
            number,
            neighborhood: sanitizeToLatinUtf8(neighborhood),
            city: sanitizeToLatinUtf8(city),
            state: sanitizeToLatinUtf8(state)
        },
        creditCard: {
            brand,
            cardNumber: cardGen.formatted,
            cardNumberMasked,
            cvv: cardGen.cvv,
            expirationDate,
            dueDay,
            cardType,
            activationState: Math.random() > 0.5 ? 'ACTIVATED' : 'AWAITING_ACTIVATION',
            limit
        },
        balance,
        dailyPixLimit,
        overdueState
    };
}
