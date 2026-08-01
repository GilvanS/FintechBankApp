# 📚 Índice de Documentação — FintechBank App

> Índice centralizado de todos os documentos do projeto. Organizado por categoria para navegação rápida.
> Cada documento tem seu propósito indicado para facilitar a escolha.

---

## 🏢 Visão Geral do Projeto

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| README Principal | [`../README.md`](../README.md) | Visão geral do repositório, instruções de setup |
| PRODUCT.md | [`../PRODUCT.md`](../PRODUCT.md) | Visão do produto, mercado, objetivos de negócio |
| DESIGN.md | [`../DESIGN.md`](../DESIGN.md) | Decisões de design e arquitetura do sistema |
| CLAUDE.md | [`../CLAUDE.md`](../CLAUDE.md) | Configuração e regras para agentes de IA (Claude Code) |
| DOCUMENTAÇÃO COMPLETA | [`../DOCUMENTACAO-COMPLETA.md`](../DOCUMENTACAO-COMPLETA.md) | Documentação consolidada histórica do projeto |
| TASK.md | [`../TASK.md`](../TASK.md) | Lista de tarefas pendentes e em andamento |
| SQL.md | [`../SQL.md`](../SQL.md) | Documentação de consultas SQL e schema |

---

## 📋 Regras de Negócio

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| **SKILL.md** | [`../SKILL.md`](../SKILL.md) | **Regras de negócio — Versão compacta para agentes de IA** (16 seções, cross-references validadas) |
| **REGRAS-NEGOCIO-FATURA.md** | [`REGRAS-NEGOCIO-FATURA.md`](REGRAS-NEGOCIO-FATURA.md) | **Regras completas de fatura e pagamento** (fonte única de verdade, 16 seções detalhadas) |
| Regras de BINs | [`regras-bins-cartoes-credito.md`](regras-bins-cartoes-credito.md) | Regras de BINs para cartões de crédito |

---

## ⚙️ Backend (API)

### Leitura Essencial

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| README Backend | [`../API/README-backend.md`](../API/README-backend.md) | Setup, endpoints principais, segurança e testes |
| CLAUDE Backend | [`../API/CLAUDE.md`](../API/CLAUDE.md) | Configuração de agente para o backend |

### Banco de Dados

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| GUIA-COMPLETO-BANCO-DADOS | [`../API/docs/GUIA-COMPLETO-BANCO-DADOS.md`](../API/docs/GUIA-COMPLETO-BANCO-DADOS.md) | Guia completo do banco de dados (schema, tabelas, relações) |
| DATABRICKS-STRUCTURE | [`../API/docs/DATABRICKS-STRUCTURE.md`](../API/docs/DATABRICKS-STRUCTURE.md) | Estrutura do Databricks (tabelas, colunas, tipos) |
| CICLO DE VIDA DA FATURA | [`../API/docs/PLANO-CICLO-VIDA-FATURA.md`](../API/docs/PLANO-CICLO-VIDA-FATURA.md) | Plano do ciclo de vida da fatura (invoice lifecycle) |
| MIGRATION README | [`../API/docs/MIGRATION-README.md`](../API/docs/MIGRATION-README.md) | Instruções de migração de banco de dados |

### Testes

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| NEWMAN-TESTS | [`../API/docs/NEWMAN-TESTS.md`](../API/docs/NEWMAN-TESTS.md) | Testes de API com Newman/Postman |
| postman-import-guide | [`../API/docs/postman-import-guide.md`](../API/docs/postman-import-guide.md) | Guia de importação da collection Postman |

### Automação e Jobs

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| README TASK SCHEDULER | [`../API/scripts/README_TASK_SCHEDULER.md`](../API/scripts/README_TASK_SCHEDULER.md) | Jobs agendados (Windows Task Scheduler), auditorias |

---

## 🌐 Frontend (WEB)

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| README Frontend | [`../WEB/README.md`](../WEB/README.md) | Setup, scripts, estrutura do frontend |
| FRONT_I | [`../WEB/FRONT_I.md`](../WEB/FRONT_I.md) | Instruções de frontend |
| BACKEND_I | [`../WEB/BACKEND_I.md`](../WEB/BACKEND_I.md) | Integração frontend-backend |
| CLAUDE Frontend | [`../WEB/CLAUDE.md`](../WEB/CLAUDE.md) | Configuração de agente para o frontend |
| Implementation Plan | [`../WEB/implementation_plan.md`](../WEB/implementation_plan.md) | Plano de implementação do frontend |
| LOCATORS GUIDE | [`../WEB/LOCATORS_GUIDE.md`](../WEB/LOCATORS_GUIDE.md) | Guia de localizadores/testes |
| Swagger | [`../WEB/swagger.md`](../WEB/swagger.md) | Documentação Swagger do frontend |
| Migration New Base | [`../WEB/docs/migration_new_base.md`](../WEB/docs/migration_new_base.md) | Migração para nova base do frontend |
| Projeto Mobile Fintech | [`../WEB/projetoMobileFintech.md`](../WEB/projetoMobileFintech.md) | Documentação do projeto mobile (cópia na WEB) |
| Registro Mockado | [`../WEB/registroMockado_I.md`](../WEB/registroMockado_I.md) | Dados mockados para testes (cópia na WEB) |
| Issue 48 | [`../WEB/docs/issue_48.md`](../WEB/docs/issue_48.md) | Issue #48 — documentação técnica |
| Issue 49 | [`../WEB/docs/issue_49.md`](../WEB/docs/issue_49.md) | Issue #49 — documentação técnica |

---

## 📱 Mobile

### Documentação Principal

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| README Mobile | [`../MOBILE/README.md`](../MOBILE/README.md) | Visão geral do app mobile |
| Projeto Mobile Fintech | [`../MOBILE/projetoMobileFintech.md`](../MOBILE/projetoMobileFintech.md) | Documentação do projeto mobile |
| Swagger Mobile | [`../MOBILE/swagger.md`](../MOBILE/swagger.md) | Documentação Swagger mobile |
| FRONT_I | [`../MOBILE/FRONT_I.md`](../MOBILE/FRONT_I.md) | Instruções de frontend mobile |
| BACKEND_I | [`../MOBILE/BACKEND_I.md`](../MOBILE/BACKEND_I.md) | Integração backend mobile |
| Registro Mockado | [`../MOBILE/registroMockado_I.md`](../MOBILE/registroMockado_I.md) | Dados mockados para testes |

### APK & Build

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| CHECKLIST-APK | [`../MOBILE/CHECKLIST-APK.md`](../MOBILE/CHECKLIST-APK.md) | Checklist para build do APK |
| COMO-GERAR-APK | [`../MOBILE/COMO-GERAR-APK.md`](../MOBILE/COMO-GERAR-APK.md) | Passo a passo para gerar APK |
| REBUILD-APK | [`../MOBILE/REBUILD-APK.md`](../MOBILE/REBUILD-APK.md) | Rebuild completo do APK |
| REBUILD-APK-PASSO-A-PASSO | [`../MOBILE/REBUILD-APK-PASSO-A-PASSO.md`](../MOBILE/REBUILD-APK-PASSO-A-PASSO.md) | Passo a passo detalhado do rebuild |
| REBUILD-APK-SELETORES | [`../MOBILE/REBUILD-APK-SELETORES.md`](../MOBILE/REBUILD-APK-SELETORES.md) | Rebuild com foco em seletores |
| GERAR-APK-DO-ZERO | [`../MOBILE/GERAR-APK-DO-ZERO.ps1`](../MOBILE/GERAR-APK-DO-ZERO.ps1) | Script PowerShell para gerar APK do zero |
| COMO-USAR-ACCESSIBILITY-PLUGIN | [`../MOBILE/COMO-USAR-ACCESSIBILITY-PLUGIN.md`](../MOBILE/COMO-USAR-ACCESSIBILITY-PLUGIN.md) | Como usar o plugin de acessibilidade |
| COMO-USAR-SCRIPTS-APK | [`../MOBILE/COMO-USAR-SCRIPTS-APK.md`](../MOBILE/COMO-USAR-SCRIPTS-APK.md) | Como usar scripts para APK |
| VERIFICAR-VERSAO-APK | [`../MOBILE/VERIFICAR-VERSAO-APK.md`](../MOBILE/VERIFICAR-VERSAO-APK.md) | Como verificar versão do APK |
| VERIFICAR-APK-ATUALIZADO | [`../MOBILE/VERIFICAR-APK-ATUALIZADO.md`](../MOBILE/VERIFICAR-APK-ATUALIZADO.md) | Como verificar se APK está atualizado |
| ANALISE-SCRIPT-GERAR-APK | [`../MOBILE/ANALISE-SCRIPT-GERAR-APK.md`](../MOBILE/ANALISE-SCRIPT-GERAR-APK.md) | Análise do script de geração de APK |

### Seletores (Appium/Testes)

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| README-SELETORES | [`../MOBILE/README-SELETORES.md`](../MOBILE/README-SELETORES.md) | Guia de seletores para testes mobile |
| SELETORES-DEFINITIVOS | [`../MOBILE/SELETORES-DEFINITIVOS.md`](../MOBILE/SELETORES-DEFINITIVOS.md) | Versão definitiva dos seletores |
| SELETORES-FUNCIONAIS-XML | [`../MOBILE/SELETORES-FUNCIONAIS-XML.md`](../MOBILE/SELETORES-FUNCIONAIS-XML.md) | Seletores funcionais em XML |
| SELETORES-JAVA-APPIUM | [`../MOBILE/SELETORES-JAVA-APPIUM.md`](../MOBILE/SELETORES-JAVA-APPIUM.md) | Seletores em Java para Appium |
| SELETORES-JAVA-COMPLETOS | [`../MOBILE/SELETORES-JAVA-COMPLETOS.md`](../MOBILE/SELETORES-JAVA-COMPLETOS.md) | Seletores Java completos |
| SELETORES-JAVA-PAGE-OBJECT | [`../MOBILE/SELETORES-JAVA-PAGE-OBJECT.md`](../MOBILE/SELETORES-JAVA-PAGE-OBJECT.md) | Page Object com seletores Java |
| SELETORES-MOBILE-BOAS-PRATICAS | [`../MOBILE/SELETORES-MOBILE-BOAS-PRATICAS.md`](../MOBILE/SELETORES-MOBILE-BOAS-PRATICAS.md) | Boas práticas de seletores mobile |
| SELETORES-REAIS-FUNCIONAIS | [`../MOBILE/SELETORES-REAIS-FUNCIONAIS.md`](../MOBILE/SELETORES-REAIS-FUNCIONAIS.md) | Seletores reais funcionais |
| SELETORES-SIMPLES-RESOURCE-ID | [`../MOBILE/SELETORES-SIMPLES-RESOURCE-ID.md`](../MOBILE/SELETORES-SIMPLES-RESOURCE-ID.md) | Seletores simples por resource-id |
| SELETORES-RESOURCE-ID-EQUIVALENTE | [`../MOBILE/SELETORES-RESOURCE-ID-EQUIVALENTE.md`](../MOBILE/SELETORES-RESOURCE-ID-EQUIVALENTE.md) | Resource ID equivalentes |
| SELETORES-WEBVIEW-APPIUM | [`../MOBILE/SELETORES-WEBVIEW-APPIUM.md`](../MOBILE/SELETORES-WEBVIEW-APPIUM.md) | Seletores para WebView no Appium |
| COMO-USAR-SELETORES-WEBVIEW | [`../MOBILE/COMO-USAR-SELETORES-WEBVIEW.md`](../MOBILE/COMO-USAR-SELETORES-WEBVIEW.md) | Guia de uso de seletores em WebView |
| SELETORES-APPIUM-CONFIRMACAO | [`../MOBILE/SELETORES-APPIUM-CONFIRMACAO.md`](../MOBILE/SELETORES-APPIUM-CONFIRMACAO.md) | Seletores de confirmação Appium |
| SELETORES-PIX-KEY-TYPE | [`../MOBILE/SELETORES-PIX-KEY-TYPE.md`](../MOBILE/SELETORES-PIX-KEY-TYPE.md) | Seletores para tipo de chave PIX |
| APPIUM-SELETORES-ANDROID | [`../MOBILE/APPIUM-SELETORES-ANDROID.md`](../MOBILE/APPIUM-SELETORES-ANDROID.md) | Guia Appium para Android |
| TEMPLATE-SELETORES-MOBILE | [`../MOBILE/TEMPLATE-SELETORES-MOBILE.md`](../MOBILE/TEMPLATE-SELETORES-MOBILE.md) | Template para criação de seletores |
| ATRIBUTOS-APPIUM-CLEAN-CODE | [`../MOBILE/ATRIBUTOS-APPIUM-CLEAN-CODE.md`](../MOBILE/ATRIBUTOS-APPIUM-CLEAN-CODE.md) | Atributos Appium clean code |
| EXPLICACAO-RESOURCE-ID | [`../MOBILE/EXPLICACAO-RESOURCE-ID.md`](../MOBILE/EXPLICACAO-RESOURCE-ID.md) | Explicação sobre resource-id |
| RESOURCE-ID-WEBVIEW-SOLUCAO | [`../MOBILE/RESOURCE-ID-WEBVIEW-SOLUCAO.md`](../MOBILE/RESOURCE-ID-WEBVIEW-SOLUCAO.md) | Solução para resource-id em WebView |
| IDS-CRIADOS-PIX-KEY-TYPE | [`../MOBILE/IDS-CRIADOS-PIX-KEY-TYPE.md`](../MOBILE/IDS-CRIADOS-PIX-KEY-TYPE.md) | IDs criados para tipo de chave PIX |

### Diagnóstico e Correções

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| DIAGNOSTICO-COMPLETO | [`../MOBILE/DIAGNOSTICO-COMPLETO.md`](../MOBILE/DIAGNOSTICO-COMPLETO.md) | Diagnóstico completo do app |
| DIAGNOSTICO-SELETORES | [`../MOBILE/DIAGNOSTICO-SELETORES.md`](../MOBILE/DIAGNOSTICO-SELETORES.md) | Diagnóstico de seletores |
| DIAGNOSTICO-VERSAO-APK | [`../MOBILE/DIAGNOSTICO-VERSAO-APK.md`](../MOBILE/DIAGNOSTICO-VERSAO-APK.md) | Diagnóstico de versão do APK |
| CORRECOES-APLICADAS | [`../MOBILE/CORRECOES-APLICADAS.md`](../MOBILE/CORRECOES-APLICADAS.md) | Correções já aplicadas no mobile |
| CORRECOES-CRITICAS-PERFORMANCE | [`../MOBILE/CORRECOES-CRITICAS-PERFORMANCE.md`](../MOBILE/CORRECOES-CRITICAS-PERFORMANCE.md) | Correções críticas de performance |
| MELHORIAS-SELETORES-LOGIN | [`../MOBILE/MELHORIAS-SELETORES-LOGIN.md`](../MOBILE/MELHORIAS-SELETORES-LOGIN.md) | Melhorias nos seletores de login |
| MELHORIAS-SELETORES-SIMPLES | [`../MOBILE/MELHORIAS-SELETORES-SIMPLES.md`](../MOBILE/MELHORIAS-SELETORES-SIMPLES.md) | Melhorias com seletores simples |
| MELHORIAS-SELETORES-V4.0.2 | [`../MOBILE/MELHORIAS-SELETORES-V4.0.2.md`](../MOBILE/MELHORIAS-SELETORES-V4.0.2.md) | Melhorias na versão 4.0.2 |
| MELHORIAS-ATRIBUTOS-APPIUM | [`../MOBILE/MELHORIAS-ATRIBUTOS-APPIUM.md`](../MOBILE/MELHORIAS-ATRIBUTOS-APPIUM.md) | Melhorias nos atributos Appium |
| MELHORIAS-CONTENT-DESC-XPATH | [`../MOBILE/MELHORIAS-CONTENT-DESC-XPATH.md`](../MOBILE/MELHORIAS-CONTENT-DESC-XPATH.md) | Melhorias content-desc e XPath |
| MELHORIAS-ESTRUTURA-ARVORE | [`../MOBILE/MELHORIAS-ESTRUTURA-ARVORE.md`](../MOBILE/MELHORIAS-ESTRUTURA-ARVORE.md) | Melhorias na estrutura da árvore |
| MELHORIAS-XPATH-ARVORE | [`../MOBILE/MELHORIAS-XPATH-ARVORE.md`](../MOBILE/MELHORIAS-XPATH-ARVORE.md) | Melhorias XPath na árvore |

### Planos e Análises Mobile

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| ANALISE-COMPLETA-PRE-APK | [`../MOBILE/ANALISE-COMPLETA-PRE-APK.md`](../MOBILE/ANALISE-COMPLETA-PRE-APK.md) | Análise completa pré-APK |
| ANALISE-FINAL | [`../MOBILE/ANALISE-FINAL.md`](../MOBILE/ANALISE-FINAL.md) | Análise final do app mobile |
| ANALISE-ID-VS-XPATH | [`../MOBILE/ANALISE-ID-VS-XPATH.md`](../MOBILE/ANALISE-ID-VS-XPATH.md) | Análise ID vs XPath |
| PLANO-DIAGNOSTICO-APK | [`../MOBILE/PLANO-DIAGNOSTICO-APK.md`](../MOBILE/PLANO-DIAGNOSTICO-APK.md) | Plano de diagnóstico do APK |
| PLANO-ACAO-PERFORMANCE | [`../MOBILE/PLANO-ACAO-PERFORMANCE.md`](../MOBILE/PLANO-ACAO-PERFORMANCE.md) | Plano de ação para performance |
| PLANO-RESOLVER-RESOURCE-ID | [`../MOBILE/PLANO-RESOLVER-RESOURCE-ID.md`](../MOBILE/PLANO-RESOLVER-RESOURCE-ID.md) | Plano para resolver resource-id |
| PLANO-ATUALIZACAO-EXTRATO-COMPROVANTE | [`../MOBILE/PLANO-ATUALIZACAO-EXTRATO-COMPROVANTE.md`](../MOBILE/PLANO-ATUALIZACAO-EXTRATO-COMPROVANTE.md) | Plano de atualização de extrato/comprovante |
| RESUMO-DIAGNOSTICO | [`../MOBILE/RESUMO-DIAGNOSTICO.md`](../MOBILE/RESUMO-DIAGNOSTICO.md) | Resumo do diagnóstico |
| RESUMO-FINAL-IMPLEMENTACAO | [`../MOBILE/RESUMO-FINAL-IMPLEMENTACAO.md`](../MOBILE/RESUMO-FINAL-IMPLEMENTACAO.md) | Resumo final da implementação |
| RESUMO-CORRECOES-APK | [`../MOBILE/RESUMO-CORRECOES-APK.md`](../MOBILE/RESUMO-CORRECOES-APK.md) | Resumo das correções do APK |
| RESUMO-CORRECOES-FINAIS | [`../MOBILE/RESUMO-CORRECOES-FINAIS.md`](../MOBILE/RESUMO-CORRECOES-FINAIS.md) | Resumo das correções finais |
| RESUMO-IMPLEMENTACAO-RESOURCE-ID | [`../MOBILE/RESUMO-IMPLEMENTACAO-RESOURCE-ID.md`](../MOBILE/RESUMO-IMPLEMENTACAO-RESOURCE-ID.md) | Resumo implementação resource-id |
| RESUMO-PLANO-APK | [`../MOBILE/RESUMO-PLANO-APK.md`](../MOBILE/RESUMO-PLANO-APK.md) | Resumo do plano do APK |
| CHECKLIST-IMPLEMENTACAO | [`../MOBILE/CHECKLIST-IMPLEMENTACAO.md`](../MOBILE/CHECKLIST-IMPLEMENTACAO.md) | Checklist de implementação |
| IMPLEMENTACAO-COMPLETA | [`../MOBILE/IMPLEMENTACAO-COMPLETA.md`](../MOBILE/IMPLEMENTACAO-COMPLETA.md) | Documentação de implementação completa |

### Troubleshooting Mobile

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| COMPARACAO-APP-NATIVO-VS-WEBVIEW | [`../MOBILE/COMPARACAO-APP-NATIVO-VS-WEBVIEW.md`](../MOBILE/COMPARACAO-APP-NATIVO-VS-WEBVIEW.md) | Comparação app nativo vs webview |
| COMPARACAO-CODIGO-XML | [`../MOBILE/COMPARACAO-CODIGO-XML.md`](../MOBILE/COMPARACAO-CODIGO-XML.md) | Comparação de código XML |
| LOCATORS-LOGIN-ERROR | [`../MOBILE/LOCATORS-LOGIN-ERROR.md`](../MOBILE/LOCATORS-LOGIN-ERROR.md) | Localizadores de erro de login |
| CORRECAO-ID-FUNCIONAR | [`../MOBILE/CORRECAO-ID-FUNCIONAR.md`](../MOBILE/CORRECAO-ID-FUNCIONAR.md) | Correção de ID para funcionar |
| CORRECAO-ADMIN-PANEL | [`../MOBILE/CORRECAO-ADMIN-PANEL.md`](../MOBILE/CORRECAO-ADMIN-PANEL.md) | Correção do painel admin |
| CORRECAO-PIX-KEYS | [`../MOBILE/CORRECAO-PIX-KEYS.md`](../MOBILE/CORRECAO-PIX-KEYS.md) | Correção de chaves PIX |
| BUG-ADMIN-PANEL | [`../MOBILE/BUG-ADMIN-PANEL.md`](../MOBILE/BUG-ADMIN-PANEL.md) | Bug no painel admin |
| BUGS-E-CORRECOES-SHOP | [`../MOBILE/BUGS-E-CORRECOES-SHOP.md`](../MOBILE/BUGS-E-CORRECOES-SHOP.md) | Bugs e correções da loja |
| ATUALIZAR-VERSAO | [`../MOBILE/ATUALIZAR-VERSAO.md`](../MOBILE/ATUALIZAR-VERSAO.md) | Como atualizar versão do app |
| RESOLVER-ERRO-KOTLIN | [`../MOBILE/RESOLVER-ERRO-KOTLIN.md`](../MOBILE/RESOLVER-ERRO-KOTLIN.md) | Como resolver erro Kotlin |
| SOLUCAO-ADB-OFFLINE | [`../MOBILE/SOLUCAO-ADB-OFFLINE.md`](../MOBILE/SOLUCAO-ADB-OFFLINE.md) | Solução para ADB offline |
| SOLUCAO-ERRO-INSTALACAO-APK | [`../MOBILE/SOLUCAO-ERRO-INSTALACAO-APK.md`](../MOBILE/SOLUCAO-ERRO-INSTALACAO-APK.md) | Solução erro instalação APK |
| SOLUCAO-XPATH-VERBOSO | [`../MOBILE/SOLUCAO-XPATH-VERBOSO.md`](../MOBILE/SOLUCAO-XPATH-VERBOSO.md) | Solução para XPath verboso |
| TESTE-CONECTIVIDADE | [`../MOBILE/TESTE-CONECTIVIDADE.md`](../MOBILE/TESTE-CONECTIVIDADE.md) | Teste de conectividade |
| EXEMPLOS-SELETORES-LOGIN | [`../MOBILE/EXEMPLOS-SELETORES-LOGIN.md`](../MOBILE/EXEMPLOS-SELETORES-LOGIN.md) | Exemplos de seletores de login |
| EXEMPLOS-SELETORES-PIX | [`../MOBILE/EXEMPLOS-SELETORES-PIX.md`](../MOBILE/EXEMPLOS-SELETORES-PIX.md) | Exemplos de seletores PIX |

---

## 🖥️ Server

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| README Server | [`../SERVER/README.md`](../SERVER/README.md) | Configuração e deploy do servidor |

---

## 🗂️ ADR (Architecture Decision Records)

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| ADR-001 | [`adr/ADR-001-revisar-plano-mobile-com-novo-design-web.md`](adr/ADR-001-revisar-plano-mobile-com-novo-design-web.md) | Revisão do plano mobile com novo design web |
| ADR-002 | [`adr/ADR-002-fonte-de-verdade-de-design-apos-remocao-do-web-new-base.md`](adr/ADR-002-fonte-de-verdade-de-design-apos-remocao-do-web-new-base.md) | Fonte de verdade de design após remoção do web-new-base |

---

## 📝 Planos e Especificações

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| Resumo e Histórico Fatura | [`plans/2026-07-07-resumo-e-historico-fatura.md`](plans/2026-07-07-resumo-e-historico-fatura.md) | Plano: resumo e histórico de fatura |
| Parcelamento Fatura | [`plans/2026-07-26-parcelamento-fatura-com-encargos.md`](plans/2026-07-26-parcelamento-fatura-com-encargos.md) | Plano: parcelamento de fatura com encargos |
| Security Fixes | [`superpowers/plans/2026-06-17-security-fixes.md`](superpowers/plans/2026-06-17-security-fixes.md) | Correções de segurança |
| Tailwind Migration | [`superpowers/plans/2026-07-03-tailwind4-migration-and-volt-modals.md`](superpowers/plans/2026-07-03-tailwind4-migration-and-volt-modals.md) | Migração Tailwind 4 + modais Volt |
| Gestão Cartões | [`superpowers/plans/2026-07-05-gestao-cartoes-fisico-virtual-e-status.md`](superpowers/plans/2026-07-05-gestao-cartoes-fisico-virtual-e-status.md) | Gestão de cartões físico/virtual e status |
| Spec Cartões API | [`superpowers/plans/2026-07-05-spec-cartoes-api-integracao.md`](superpowers/plans/2026-07-05-spec-cartoes-api-integracao.md) | Spec da API de cartões |
| Layout Faturas | [`tasks/LAYOUT_FATURAS_SPEC.md`](tasks/LAYOUT_FATURAS_SPEC.md) | Spec de layout da tela de faturas |
| Auditoria Mobile vs Web | [`tasks/T1-AUDITORIA-MOBILE-VS-WEB.md`](tasks/T1-AUDITORIA-MOBILE-VS-WEB.md) | Auditoria de diferenças mobile vs web |
| GRAPHIFY-RESUMIR | [`GRAPHIFY-RESUMIR.md`](GRAPHIFY-RESUMIR.md) | Documentação de grafo/resumo |
| Implementation Plan (root) | [`../implementation_plan.md`](../implementation_plan.md) | Plano de implementação geral |

---

## 🛠️ Configuração e Setup

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| CONFIG-IP-FIXO-WINDOWS | [`../CONFIG-IP-FIXO-WINDOWS.md`](../CONFIG-IP-FIXO-WINDOWS.md) | Configuração de IP fixo no Windows |
| CONFIG-MOBILE-WIFI | [`../CONFIG-MOBILE-WIFI.md`](../CONFIG-MOBILE-WIFI.md) | Configuração de WiFi para mobile |
| CONFIGURACAO-FINAL | [`../CONFIGURACAO-FINAL.md`](../CONFIGURACAO-FINAL.md) | Configuração final do ambiente |
| PLANO-AUTOMACAO-LOCAL | [`../PLANO-AUTOMACAO-LOCAL.md`](../PLANO-AUTOMACAO-LOCAL.md) | Plano de automação local |
| PLANO-CORRECAO-BACKEND | [`../PLANO-CORRECAO-BACKEND.md`](../PLANO-CORRECAO-BACKEND.md) | Plano de correção do backend |
| PLANO-RESTAURACAO | [`../PLANO-RESTAURACAO.md`](../PLANO-RESTAURACAO.md) | Plano de restauração do sistema |
| SOLUCAO-RAPIDA | [`../SOLUCAO-RAPIDA.md`](../SOLUCAO-RAPIDA.md) | Solução rápida para problemas comuns |

---

## 🐛 Changelogs e Histórico

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| UPDATE LOG | [`../UPDATE_LOG_2025-11-23.md`](../UPDATE_LOG_2025-11-23.md) | Log de atualizações (2025-11-23) |
| BUGS | [`../BUGS-2025-11-26.md`](../BUGS-2025-11-26.md) | Registro de bugs conhecidos |
| CHANGELOG SHOP | [`../CHANGELOG_SHOP_FEATURE.md`](../CHANGELOG_SHOP_FEATURE.md) | Changelog da funcionalidade Shop/Loja |
| SYNCHRONIZATION ANALYSIS | [`../SYNCHRONIZATION_ANALYSIS.md`](../SYNCHRONIZATION_ANALYSIS.md) | Análise de sincronização entre sistemas |
| README Frontend | [`../README-frontend.md`](../README-frontend.md) | Instruções específicas do frontend (root) |

---

## ❓ Troubleshooting

| Documento | Caminho | Propósito |
|:----------|:--------|:----------|
| Troubleshooting Docker | [`2026-07-07-troubleshooting-docker.md`](2026-07-07-troubleshooting-docker.md) | Problemas comuns com Docker |
| Troubleshooting (SKILL.md) | [`../SKILL.md#12-troubleshooting--erros-comuns`](../SKILL.md#12-troubleshooting--erros-comuns) | 12 erros comuns (EADDRINUSE, 403, Vite, etc.) |
| Curl Commands | [`../curl-commands.md`](../curl-commands.md) | Comandos curl de referência para testes manuais |

---

## 🔍 Como Usar Este Índice

1. **Navegue por categoria** (Visão Geral → Backend → Frontend → Mobile → ...)
2. **Cada tabela** mostra: nome do documento, caminho relativo e propósito
3. **Documentos em negrito** são os mais importantes/consultados
4. **Links são relativos** — funcionam tanto no GitHub quanto localmente
5. **Adicione novos documentos** no final da categoria correspondente

### Manutenção

Para manter este índice atualizado:
- Ao criar um novo `.md` na raiz ou em `docs/`, adicione-o aqui
- Ao mover/renomear um documento, atualize o link
- Mantenha a ordenação alfabética dentro de cada categoria
