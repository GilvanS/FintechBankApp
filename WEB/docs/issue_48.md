# Issue #48: Adaptação das Telas Admin e Shop para Modais

## Descrição
As telas `Admin.tsx` e `Shop.tsx` atualmente ocupam a visualização principal (como "páginas") e não estão seguindo o novo layout estético do projeto (como o da tela home e modais Pix/Deposit). O objetivo desta issue é converter essas telas para Modais largos (`max-w-5xl`) e escuros (com `backdrop-blur` e `bg-volt-dark`), permitindo que elas aproveitem o espaço da tela mantendo o design do projeto.

## Critérios de Aceite
- [x] Refatorar `Admin.tsx` para ser um Modal e renderizar acima da tela inicial.
- [x] Refatorar `Shop.tsx` para ser um Modal e renderizar acima da tela inicial.
- [x] Utilizar as bibliotecas `framer-motion` (`AnimatePresence`, `motion.div`) para gerenciar as animações de entrada/saída.
- [x] Atualizar a navegação em `Dashboard.tsx` para disparar os modais `isAdminModalOpen` e `isShopModalOpen` ao invés de trocar a `topLevelView`.
- [x] Garantir as larguras corretas para não simular um mobile nestes modais específicos.
