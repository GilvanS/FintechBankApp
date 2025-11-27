export class AppVersion {
    private static readonly _version = "1.1.1";
    private static readonly _build = "20251126";
    private static readonly _environment = "HotFix";

    static get current(): string {
        return `${this._version}`;
    }

    static get fullDetails(): string {
        return `Versão: ${this._version}\nBuild: ${this._build}\nAmbiente: ${this._environment}`;
    }
}
