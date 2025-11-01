export class LoggerService {
    static info(message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }

    static error(message: string, error?: any): void {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`, error);
    }

    static warn(message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }

    static debug(message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        console.debug(`[${timestamp}] DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
}