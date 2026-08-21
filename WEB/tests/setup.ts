import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// jsdom não implementa matchMedia — usado pelas guardas de prefers-reduced-motion.
if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
}

// O modo demo carrega as massas via fetch dos CSVs em public/demo-data.
// No jsdom não há servidor, então servimos os mesmos arquivos do disco.
vi.stubGlobal('fetch', async (input: any) => {
    const url = String(input);
    const match = url.match(/demo-data\/([\w-]+\.csv)$/);
    if (!match) {
        return { ok: false, status: 404, text: async () => '' } as Response;
    }
    const file = resolve(__dirname, '../public/demo-data', match[1]);
    return { ok: true, status: 200, text: async () => readFileSync(file, 'utf8') } as Response;
});

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => children,
    PieChart: ({ children }: any) => children,
    Pie: () => null,
    Cell: () => null,
    Tooltip: () => null,
    BarChart: ({ children }: any) => children,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
    LineChart: ({ children }: any) => children,
    Line: () => null,
    AreaChart: ({ children }: any) => children,
    Area: () => null,
}));