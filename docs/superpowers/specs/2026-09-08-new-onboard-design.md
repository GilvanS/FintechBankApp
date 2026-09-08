# Specification & Design: New Onboard (Cadastro WEB Allure 360°) & Admin Theme Default

**Data:** 2026-09-08  
**Status:** Aprovado em Brainstorming  
**Autor:** Antigravity / Claude Code  

---

## 1. Visão Geral

Melhoria completa no fluxo de aquisição e cadastro público (`/signup`, `/onboarding`, `/new-onboard`) do FintechBankApp. O novo fluxo **New Onboard** adota a arquitetura de layout **WEB Allure Nativo em Tela Cheia (2 Modais/Cards 50%/50%)**, integrando todos os novos campos e dados ricos provenientes do **Gerador de Massas 3.0** (dados pessoais, tutor para menores, endereço residencial com suporte a múltiplos países, personalização de cartão de crédito e escolha de plano da conta).

Além disso, inclui parâmetro no Painel Admin para definir o **Modo de Tema Padrão do Sistema (Dark/Midnight vs Normal/Yellow)** para novos usuários e inicialização do app.

---

## 2. Requisitos & Diretrizes

### 2.1 Cadastro & Onboarding ("New Onboard")
- **Padrão Limpo (Adimplente Default)**: O fluxo público de cadastro gera contas 100% limpas (adimplentes), **sem opção de seletor de inadimplência/dias em atraso** (recurso exclusivo do painel admin de testes/massas).
- **Layout WEB Allure Fullscreen 50%/50%**:
  - **Lado Esquerdo (50%)**: Card/Modal formulário rolável em container Allure nativo.
  - **Lado Direito (50%)**: Card/Modal preview 3D interativo do cartão + resumo do plano/benefícios em tempo real.
- **Campos & Etapas do Formulário (Esquerda)**:
  1. **Dados Pessoais**: Nome Completo, CPF (com validação DV e máscara), Data de Nascimento (cálculo automático de Idade).
     - *Se Idade < 18 anos*: Exibe obrigatoriamente a seção **Dados do Tutor Legal** (Nome Completo do Tutor + CPF do Tutor).
  2. **Acesso & Contato**: E-mail, Celular (`(XX) XXXXX-XXXX`), Senha (6 a 12 caracteres + confirmação).
  3. **Endereço Residencial (Global)**: País (default Brasil 🇧🇷 + seletor global), CEP, Logradouro, Número, Bairro, Cidade e Estado (UF).
  4. **Personalização do Cartão de Crédito**:
     - Bandeira (Visa 💳, Mastercard 🔴🟡, Elo 🟡🔵, Amex 🟦).
     - Categoria / Tier (Gold, Platinum, VIP Black).
     - Dia de Vencimento da Fatura (Pills interativas: Dias 05, 10, 15, 20, 25).
     - Nome Impresso no Cartão (editável).
  5. **Plano da Conta & Chave PIX**:
     - Escolha do Plano (Gratuito R$ 0 / Volt Pro R$ 19,90/mês / VIP Black R$ 49,90/mês).
     - Chave PIX Preferencial (sugestão auto por CPF/Celular).

### 2.2 Preview 3D do Cartão & Segurança (Direita)
- **Visual 3D & Efeito de Seleção (Motion/GSAP)**:
  - Mantém 100% o efeito 3D interativo (hover/click, tilt, rotação suave, gradientes metálicos conforme Tier Gold/Platinum/Black, troca de logotipos da bandeira).
- **Restrição Estrita de Segurança**:
  - **Número Completo do Cartão NÃO é exibido**: Mascarado como `•••• •••• •••• 8832` (exibe apenas os últimos 4 dígitos gerados).
  - **CVV NÃO é exibido**: Fixo e mascarado como `•••` por motivos de segurança no onboarding.
- **Resumo Financeiro do Pedido**:
  - Exibe Custo Anuidade Cartão + Mensalidade do Plano = Total Mensal.
  - Exibe Badge de Limite Pré-Aprovado Inicial estimado (`R$ 2.500,00`).

### 2.3 Configuração de Tema Padrão no Admin
- **Nova Opção no Painel Admin**:
  - Parâmetro em `AdminDashboard`: **"Modo de Tema Padrão da Aplicação WEB"**.
  - Opções: `Dark (Midnight)` vs `Normal (Yellow)`.
  - Salva preferência em `localStorage.setItem('volt_admin_default_theme', 'midnight' | 'yellow')` e backend/config.
  - `AppStateContext`: No carregamento inicial, se o usuário não possui uma preferência individual definida, utiliza a preferência configurada pelo Administrador.

---

## 3. Arquitetura de Componentes & Arquivos

```
WEB/
├── components/
│   ├── Onboard/
│   │   ├── NewOnboardView.tsx         # Container Allure Fullscreen 50%/50%
│   │   ├── OnboardFormContainer.tsx   # Formulário rolável (Campos Pessoais, Tutor, Endereço, Cartão, Plano)
│   │   └── CardPreview3D.tsx          # Card 3D interativo + Mascaramento de Segurança + Resumo de Custos
│   └── Admin/
│       └── SystemSettingsSection.tsx  # Seção Admin para configuração de Tema Padrão (Dark/Light)
├── contexts/
│   └── AppStateContext.tsx            # Suporte ao tema padrão do admin no boot
└── routes / App.tsx                    # Roteamento de /signup e /new-onboard
```

---

## 4. Plano de Validação & Testes

1. **Testes Unitários / Integração (Vitest)**:
   - Validação dos formulários do New Onboard (CPF, Tutor obrigatorio para < 18, senhas).
   - Validação de mascaramento de segurança do cartão (`•••• •••• •••• XXXX` e `•••`).
   - Validação da persistência do Tema Padrão alterado pelo Admin.
2. **Navegação & UX**:
   - Verificar responsividade em telas mobile e desktop 50%/50%.
   - Efeitos visuais 3D do cartão e troca fluida de bandeiras/tiers.
