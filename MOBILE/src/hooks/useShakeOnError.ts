import { useCallback, useRef, type KeyboardEvent } from 'react';

// Efeito de shake de erro (ref: Transitions.dev — Error state shake).
// MOBILE roda em WebView (Ionic/Capacitor + React DOM), não React Native —
// mesma técnica CSS/DOM do WEB (ver src/theme/variables.css: .t-shake).
// Uso: const { setRef, shakeAll } = useShakeOnError();
//      <input ref={setRef('cpf')} ... />
//      if (errors.cpf) shakeAll(['cpf']) // ou shake('cpf')
export function useShakeOnError() {
    const elementsRef = useRef<Record<string, HTMLElement | null>>({});

    const setRef = useCallback(
        (name: string) => (el: HTMLElement | null) => {
            elementsRef.current[name] = el;
        },
        []
    );

    const shake = useCallback((name: string) => {
        const el = elementsRef.current[name];
        if (!el) return;
        // Adiado pro próximo tick: shake() normalmente é chamado no mesmo
        // handler que seta o estado de erro (setFieldErrors/setError), e o
        // commit do React reescreve o className via JSX logo em seguida —
        // se a classe fosse adicionada agora, esse commit a apagaria antes
        // da animação rodar.
        setTimeout(() => {
            el.classList.remove('t-shake');
            // Força reflow para reiniciar a animação mesmo se já estava com a classe.
            void el.offsetWidth;
            el.classList.add('t-shake');
        }, 0);
    }, []);

    const shakeAll = useCallback(
        (names: string[]) => {
            names.forEach(shake);
        },
        [shake]
    );

    // Handler para disparar o shake quando o usuário tenta digitar além do
    // limite de caracteres (o atributo maxLength bloqueia o input antes do
    // onChange disparar, então o gatilho precisa ficar no keydown).
    const onMaxLengthKeyDown = useCallback(
        (name: string, maxLength: number) =>
            (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const isPrintableKey = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
                const target = e.currentTarget;
                if (
                    isPrintableKey &&
                    target.value.length >= maxLength &&
                    target.selectionStart === target.selectionEnd
                ) {
                    shake(name);
                }
            },
        [shake]
    );

    return { setRef, shake, shakeAll, onMaxLengthKeyDown };
}
