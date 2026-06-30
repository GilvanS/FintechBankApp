# Objetivo

Migrar todas as atualizações, novos componentes e dados inseridos na pasta de referência (`new-base-fintechbank`) para a pasta da aplicação principal (`WEB/components`), garantindo que o novo visual **Neon Glassmorphism** (translucidez e sem bordas duras) seja mantido e que a marca correta (**FintechBank**) seja utilizada.

> [!WARNING]
> Os arquivos na pasta de referência (`new-base-fintechbank`) possuem o estilo visual antigo (Brutalismo: `border-4 border-black`, sombras sólidas). Se apenas copiarmos e colarmos os arquivos diretamente, perderemos todo o trabalho de design moderno e translúcido que fizemos hoje. 

> [!IMPORTANT]
> Precisamos portar a lógica e os novos recursos (como os modais de IA e Boleto), mas reescrevendo as classes do Tailwind para o nosso estilo atual.

## User Review Required

1. **Substituição Visual Completa**: Para cada novo arquivo que eu trouxer de `new-base-fintechbank`, vou buscar e substituir as classes `border-4`, `border-black` e `shadow-[...]` pelas nossas classes de *Glassmorphism* (`border border-white/5`, `bg-white/5`, etc). Você está de acordo com a conversão dessas classes para que o design não quebre?
2. **Substituição de Texto**: Vou buscar todas as referências ao nome "Volt" e substituir por "FintechBank".

## Componentes Novos e Atualizados a Serem Migrados

### 1. Novos Componentes (Atualmente Inexistentes na Principal)
- [NEW] `AiAssistantModal.tsx`
- [NEW] `AiRecurringBillModal.tsx`
- [NEW] `BoletoModal.tsx`
- [NEW] `CardsView.tsx`
- [NEW] `FinancialHealthModal.tsx`

### 2. Componentes Modificados a serem Mesclados/Substituídos
- [MODIFY] `App.tsx` (ou `main.tsx`)
- [MODIFY] `Header.tsx`
- [MODIFY] `HomeView.tsx`
- [MODIFY] `LimitView.tsx`
- [MODIFY] `Navbar.tsx`
- [MODIFY] `PixModal.tsx`
- [MODIFY] `ShopView.tsx`
- [MODIFY] `StatementView.tsx`
- [MODIFY] `WeeklyStreak.tsx`
- [MODIFY] `BiometricModal.tsx`
- [MODIFY] `DepositModal.tsx`
- [MODIFY] `InvoiceView.tsx`
- [MODIFY] `ProfileView.tsx`

## Proposed Changes

Vou criar um script de migração atualizado (similar ao que usei antes, mas focado na **conversão global**). 
O script fará o seguinte:
1. Ler o conteúdo de cada arquivo modificado/novo na pasta `new-base-fintechbank/src/components`.
2. Rodar um filtro de texto (`Regex` ou `replace`) em cada código lido para arrancar o estilo brutalista:
   - `border-4 border-black` -> `border border-white/5`
   - `shadow-[Xpx_Ypx_0px_0px_rgba(0,0,0,1)]` -> `shadow-2xl`
   - `"Volt"` -> `"FintechBank"`
3. Salvar os arquivos processados dentro da sua pasta `WEB/components`.

## Verification Plan

### Automated Tests
- Executaremos `npm run build` na pasta `WEB` para garantir que as tipagens e exportações estejam corretas.

### Manual Verification
- Você deverá abrir o aplicativo no navegador (`npm run dev`) e verificar se os novos modais (IA, Boleto, Saúde Financeira) abrem sem quebrar a tela e se todos aparecem em Neon Glassmorphism em vez de caixas brancas duras com bordas pretas.
