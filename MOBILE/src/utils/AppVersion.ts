export class AppVersion {
    private static readonly _version = "1.0.5";
    private static readonly _build = "20231124";
    private static readonly _environment = "Production";

    static get current(): string {
        return `${this._version}`;
    }

    static get fullDetails(): string {
        return `Versão: ${this._version}\nBuild: ${this._build}\nAmbiente: ${this._environment}`;
    }
}
