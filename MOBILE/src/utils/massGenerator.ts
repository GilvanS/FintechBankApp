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

/**
 * Cenários de massa EM ATRASO oferecidos pelo gerador. Cada nível define os dias
 * de atraso e o valor (principal) da fatura fechada vencida a ser gerada no PGDB.
 */
export const OVERDUE_TIERS: Record<Exclude<OverdueState, 'EM_DIA'>, { days: number; amount: number; label: string; desc: string }> = {
    EM_ATRASO_7D: { days: 7, amount: 1250.00, label: 'Atraso Leve (7 dias)', desc: 'Fatura fechada vencida de R$ 1.250,00 com 5 encargos ISO' },
    EM_ATRASO_15D: { days: 15, amount: 3870.86, label: 'Atraso Médio (15 dias)', desc: 'Fatura fechada vencida de R$ 3.870,86 com 5 encargos ISO' },
    EM_ATRASO_30D: { days: 30, amount: 7500.00, label: 'Atraso Grave (30 dias)', desc: 'Fatura fechada vencida de R$ 7.500,00 com 5 encargos ISO' },
};

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
    names: string[];
    streets: string[];
    neighborhoods: string[];
    cities: string[];
    states: string[];
    ceps: string[];
    tutorNames: string[];
}> = {
    'Brasil': {
        names: ['Lucas Gabriel Ferreira', 'Mariana Costa Silva', 'Rodrigo Mendes Oliveira', 'Camila Beatriz Santos', 'Bruno Henrique Alves', 'Isabela Rocha Carvalho', 'Gabriel Vinicius Souza', 'Juliana Lima Rezende'],
        streets: ['Avenida Paulista', 'Rua Augusta', 'Avenida Copacabana', 'Rua das Flores', 'Avenida Brigadeiro Faria Lima', 'Avenida Afonso Pena'],
        neighborhoods: ['Bela Vista', 'Consolacao', 'Copacabana', 'Centro', 'Itaim Bibi', 'Savassi'],
        cities: ['Sao Paulo', 'Rio de Janeiro', 'Curitiba', 'Belo Horizonte', 'Porto Alegre', 'Salvador'],
        states: ['SP', 'RJ', 'PR', 'MG', 'RS', 'BA'],
        ceps: ['01310-200', '22070-011', '80010-000', '30130-010', '90010-000', '40020-000'],
        tutorNames: ['Carlos Eduardo Ferreira (Pai)', 'Ana Maria Silva (Mae)', 'Roberto Mendes Oliveira (Tutor Legal)']
    },
    'Estados Unidos': {
        names: ['Alexander James Smith', 'Emily Rose Johnson', 'Michael David Williams', 'Sophia Grace Brown', 'William Robert Miller', 'Olivia Elizabeth Davis'],
        streets: ['Fifth Avenue', 'Broadway Street', 'Ocean Drive', 'Sunset Boulevard', 'Michigan Avenue', 'Peachtree Street'],
        neighborhoods: ['Manhattan', 'South Beach', 'Hollywood', 'Downtown', 'Lincoln Park', 'Midtown'],
        cities: ['Nova York', 'Miami', 'Los Angeles', 'Chicago', 'Atlanta', 'San Francisco'],
        states: ['NY', 'FL', 'CA', 'IL', 'GA', 'CA'],
        ceps: ['10001', '33139', '90028', '60611', '30303', '94102'],
        tutorNames: ['Robert Smith (Father)', 'Jennifer Johnson (Mother)']
    },
    'Japão': {
        names: ['Taro Tanaka', 'Kenji Sato', 'Yuki Takahashi', 'Hanako Watanabe', 'Ren Ito', 'Aoi Yamamoto'],
        streets: ['Avenida Marunouchi', 'Rua Ginza Chuo', 'Avenida Dotonbori', 'Rua Shinjuku-dori', 'Rua Kawaramachi'],
        neighborhoods: ['Chiyoda', 'Chuo-ku', 'Namba', 'Shinjuku', 'Nakagyo-ku'],
        cities: ['Toquio', 'Toquio', 'Osaka', 'Toquio', 'Quioto'],
        states: ['Toquio', 'Toquio', 'Osaka', 'Toquio', 'Quioto'],
        ceps: ['100-0005', '104-0061', '542-0071', '160-0022', '604-8026'],
        tutorNames: ['Hiroshi Tanaka (Pai)', 'Kazuko Sato (Mae)']
    },
    'China': {
        names: ['Wei Li', 'Ming Zhang', 'Xiu Ying Wang', 'Lei Chen', 'Jian Liu', 'Yan Yang'],
        streets: ['Avenida Jianguomen', 'Rua Nanjing East', 'Avenida Huaihai', 'Rua Beijing Road'],
        neighborhoods: ['Chaoyang', 'Huangpu', 'Xuhui', 'Yuexiu'],
        cities: ['Pequim', 'Xangai', 'Xangai', 'Guangzhou'],
        states: ['Pequim', 'Xangai', 'Xangai', 'Guangdong'],
        ceps: ['100004', '200001', '200030', '510000'],
        tutorNames: ['Guowei Li (Pai)', 'Mei Zhang (Mae)']
    },
    'Coreia do Sul': {
        names: ['Minjun Kim', 'Seoyun Lee', 'Jiwoo Park', 'Dohyun Choi', 'Haewon Jung', 'Joon Jeong'],
        streets: ['Rua Teheran-ro', 'Avenida Jong-ro', 'Rua Haeundae-ro', 'Avenida Seochodaero'],
        neighborhoods: ['Gangnam', 'Jongno-gu', 'Haeundae', 'Seocho'],
        cities: ['Seul', 'Seul', 'Busan', 'Seul'],
        states: ['Seul', 'Seul', 'Busan', 'Seul'],
        ceps: ['06164', '03154', '48094', '06591'],
        tutorNames: ['Sangwon Kim (Pai)', 'Hyunjae Lee (Mae)']
    },
    'Arábia Saudita': {
        names: ['Tariq Al-Mansoor', 'Fahad Al-Ghamdi', 'Noura Al-Saud', 'Youssef Al-Otaibi', 'Khalid Al-Zahrani', 'Fatima Al-Harbi'],
        streets: ['Avenida King Fahd', 'Rua Olaya Main', 'Avenida Tahlia', 'Rua Corniche'],
        neighborhoods: ['Al-Olaya', 'Al-Malaz', 'Al-Hamra', 'Al-Shati'],
        cities: ['Riad', 'Riad', 'Jeda', 'Dammam'],
        states: ['Riad', 'Riad', 'Meca', 'Oriental'],
        ceps: ['12211', '12836', '23212', '32414'],
        tutorNames: ['Sultan Al-Mansoor (Pai)', 'Aisha Al-Ghamdi (Mae)']
    },
    'Portugal': {
        names: ['Joao Pedro Silva', 'Beatriz Ferreira', 'Goncalo Santos', 'Ines Oliveira', 'Martim Costa'],
        streets: ['Avenida da Liberdade', 'Rua Garrett', 'Avenida dos Aliados', 'Rua de Santa Catarina'],
        neighborhoods: ['Baixa', 'Chiado', 'Santo Ildefonso', 'Cedofeita'],
        cities: ['Lisboa', 'Lisboa', 'Porto', 'Porto'],
        states: ['Lisboa', 'Lisboa', 'Porto', 'Porto'],
        ceps: ['1250-096', '1200-203', '4000-064', '4000-442'],
        tutorNames: ['Antonio Silva (Pai)', 'Maria Ferreira (Mae)']
    },
    'Alemanha': {
        names: ['Maximilian Mueller', 'Sophie Schmidt', 'Lukas Schneider', 'Hannah Fischer', 'Felix Weber'],
        streets: ['Kurfuerstendamm', 'Unter den Linden', 'Maximilianstrasse', 'Kaufingerstrasse'],
        neighborhoods: ['Charlottenburg', 'Mitte', 'Altstadt', 'Maxvorstadt'],
        cities: ['Berlim', 'Berlim', 'Munique', 'Munique'],
        states: ['Berlim', 'Berlim', 'Baviera', 'Baviera'],
        ceps: ['10707', '10117', '80539', '80331'],
        tutorNames: ['Klaus Mueller (Vater)', 'Birgit Schmidt (Mutter)']
    },
    'França': {
        names: ['Jean Dupont', 'Camille Martin', 'Pierre Bernard', 'Chloé Dubois', 'Lucas Laurent'],
        streets: ['Avenue des Champs-Élysées', 'Rue de Rivoli', 'Boulevard Saint-Germain', 'Rue St-Ferréol'],
        neighborhoods: ['8ème Arrondissement', '1er Arrondissement', '6ème Arrondissement', 'Vieux-Port'],
        cities: ['Paris', 'Paris', 'Paris', 'Marselha'],
        states: ['Île-de-France', 'Île-de-France', 'Île-de-France', 'PACA'],
        ceps: ['75008', '75001', '75006', '13001'],
        tutorNames: ['Henri Dupont (Père)', 'Sophie Martin (Mère)']
    },
    'Itália': {
        names: ['Matteo Rossi', 'Giulia Russo', 'Alessandro Ferrari', 'Sofia Esposito', 'Leonardo Bianchi'],
        streets: ['Via del Corso', 'Via Montenapoleone', 'Corso Vittorio Emanuele', 'Via Roma'],
        neighborhoods: ['Centro Storico', 'Quadrilatero della Moda', 'Brera', 'Chiaia'],
        cities: ['Roma', 'Milao', 'Milao', 'Napoles'],
        states: ['Lazio', 'Lombardia', 'Lombardia', 'Campania'],
        ceps: ['00186', '20121', '20122', '80121'],
        tutorNames: ['Marco Rossi (Padre)', 'Elena Russo (Madre)']
    },
    'Argentina': {
        names: ['Joaquin Gonzalez', 'Valentina Rodriguez', 'Mateo Fernandez', 'Camila Lopez', 'Santiago Gomez'],
        streets: ['Avenida 9 de Julio', 'Avenida Corrientes', 'Calle Florida', 'Avenida Colon'],
        neighborhoods: ['Palermo', 'San Telmo', 'Recoleta', 'Centro'],
        cities: ['Buenos Aires', 'Buenos Aires', 'Buenos Aires', 'Cordoba'],
        states: ['CABA', 'CABA', 'CABA', 'Cordoba'],
        ceps: ['C1043', 'C1004', 'C1005', 'X5000'],
        tutorNames: ['Gonzalo Gonzalez (Padre)', 'Lucia Rodriguez (Madre)']
    }
};

const COUNTRIES_LIST = Object.keys(GLOBAL_DATASET);

/**
 * Gera um perfil completo de massa de teste randômica para o país especificado (ou qualquer país do mundo).
 */
export function generateRandomMassData(selectedCountry?: string, forceAgeCondition?: 'normal' | 'under18' | 'over80'): GeneratedMassData {
    const country = (selectedCountry && GLOBAL_DATASET[selectedCountry])
        ? selectedCountry
        : COUNTRIES_LIST[Math.floor(Math.random() * COUNTRIES_LIST.length)];

    const dataset = GLOBAL_DATASET[country] || GLOBAL_DATASET['Brasil'];

    const fullName = dataset.names[Math.floor(Math.random() * dataset.names.length)];
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
    const dueDays = [5, 10, 15, 20, 25];
    const dueDay = dueDays[Math.floor(Math.random() * dueDays.length)];
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
