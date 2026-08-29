export class AppVersion {
    private static readonly _version = "4.0.4-20260827-1252";
    private static readonly _build = "20260827-1252";
    private static readonly _environment = "HotFix";

    static get current(): string {
        return `${this._version}`;
    }

    static get fullDetails(): string {
        return `Versão: ${this._version}\nBuild: ${this._build}\nAmbiente: ${this._environment}`;
    }
}