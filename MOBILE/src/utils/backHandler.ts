/**
 * Ponte entre o botão físico/gesto de voltar do Android (Capacitor App plugin)
 * e a pilha de navegação interna do app, que não usa router nem history —
 * é só useState (view no App.tsx, currentView/previousView no Dashboard.tsx).
 *
 * A tela que possui a pilha de navegação ativa no momento registra aqui um
 * handler; App.tsx chama esse handler a cada back físico. Handler retorna
 * true quando consumiu o back (navegou para trás), false quando não há mais
 * para onde voltar — nesse caso App.tsx minimiza o app.
 */

type BackHandler = () => boolean;

let currentHandler: BackHandler | null = null;

export function setBackHandler(handler: BackHandler | null): void {
    currentHandler = handler;
}

export function runBackHandler(): boolean {
    return currentHandler ? currentHandler() : false;
}
