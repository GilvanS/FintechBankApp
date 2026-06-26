import '@testing-library/jest-dom';
import { vi } from 'vitest';

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