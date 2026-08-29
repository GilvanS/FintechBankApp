# Plano de Ação DE PARA Final — Paridade WEB vs MOBILE

**Data:** 28/08/2026  
**Arquivo Permanente:** `docs/plans/2026-08-27-plano-de-para-web-mobile.md`  

---

## 1. Diagnóstico do Problema de Navegação Identificado

Após auditoria detalhada dos menus da WEB (`WEB/components/BottomNavBar.tsx`) e do MOBILE (`MOBILE/src/components/BottomNavBar.tsx`), identificamos a causa exata da divergência no fluxo de Faturas:

- **Na WEB**: O **2º ícone do BottomNavBar** é a opção dedicada **"Faturas"** (`invoices`), que leva direto à gestão de faturas em 1 clique.
- **No MOBILE**: A opção "Faturas" **não existia no menu principal**, estando escondida dentro da aba "Cartões", exigindo 2 cliques.

---

## 2. Ações de Correção e Paridade Total

### Ação 1: Ajuste do Menu Inferior (`BottomNavBar.tsx` no MOBILE)
- Adicionar o item **Faturas** (`invoices`) na barra de navegação inferior do MOBILE com o ícone `<FileText />`.
- Ajustar os itens para refletir a ordem exata da WEB:
  1. **Início** (`home`)
  2. **Faturas** (`invoices`)
  3. **Cartões** (`cards`)
  4. **Shop** (`shop`)
  5. **Perfil** (`profile`)

### Ação 2: Roteador Principal do MOBILE (`Dashboard.tsx`)
- Adicionar o `case 'invoices':` no switch de renderização do MOBILE, apontando para o componente `<InvoicesView user={user} onBack={handleBack} onNavigate={handleNavigate} />`.

### Ação 3: Efeito Visual de Escala (Sheet Push-back)
- Garantir que a abertura de modais ou transição para Faturas/Limites acione a animação de escala suave (`scale-[0.96] opacity-90 rounded-3xl`) no fundo da Home.

---

## 3. Validação e Testes

1. **TypeScript**: `npx tsc --noEmit` sem erros.
2. **Testes Unitários**: `npm test` no MOBILE (80+ testes passantes).
3. **Build**: `npm run build` e `npx cap sync android`.