# Agendador de Tarefas (Windows Task Scheduler)

Duas tarefas agendadas para manter o sistema FintechBank sincronizado automaticamente:

| Tarefa | Frequência | Horário | O que faz |
|:-------|:-----------|:--------|:----------|
| **Validação de Faturamento** | Diária | 01:00 | `runBillingValidation` — sincroniza inadimplência e encargos |
| **Auditoria Completa** | Semanal (domingo) | 02:00 | Consistência + double-counting + saldo negativo |

---

## 1. Validação de Faturamento (diária às 01:00)

Backup do cron interno do servidor (meia-noite). Se o servidor estiver fora do ar
à meia-noite, a validação roda automaticamente uma hora depois.

### Arquivos

| Arquivo | Descrição |
|:--------|:----------|
| `schtask_billing_validate.ps1` | Script PowerShell que autentica e chama `POST /admin/billing/validate-all` |
| `schtask_billing_validate.xml` | Definição da tarefa no Windows Task Scheduler |
| `logs/` | Diretório de logs (criado automaticamente) |

### Instalação

```powershell
schtasks /Create /XML "F:\GITHUB\FintechBankApp\API\scripts\schtask_billing_validate.xml" /TN "FintechBank\BillingValidateDaily" /F
```

### Testar

```powershell
schtasks /Run /TN "FintechBank\BillingValidateDaily"
```

### Logs

```
scripts/logs/billing_validate_2026-07-27_01-00-00.log
```

---

## 2. Auditoria Completa (semanal — domingo às 02:00)

Executa **3 auditorias** em sequência e gera relatório HTML unificado:

1. **Consistência** — compara `users.days_overdue` e `invoices.dias_atraso` com o cálculo em tempo real
2. **Double-Counting** — verifica se pagamentos de fatura foram contados em dobro no `currentInvoice`
3. **Saldo Negativo** — detecta `valor_pago > valor_total` e discrepâncias financeiras

### Arquivos

| Arquivo | Descrição |
|:--------|:----------|
| `schtask_audit_all.bat` | Script batch que executa `npm run audit:all` (Node.js direto no BD) |
| `schtask_audit_all.xml` | Definição da tarefa no Windows Task Scheduler |
| `logs/` | Diretório de logs (criado automaticamente) |

### Instalação

```powershell
schtasks /Create /XML "F:\GITHUB\FintechBankApp\API\scripts\schtask_audit_all.xml" /TN "FintechBank\AuditAllWeekly" /F
```

### Testar

```powershell
schtasks /Run /TN "FintechBank\AuditAllWeekly"
```

### Relatórios gerados

```
scripts/audit_report_2026-07-27_14-45-00.html    (consistência)
scripts/audit_report_2026-07-27_14-45-00.csv     (consistência — se com --csv)
scripts/audit_all_report_2026-07-27_14-45-00.html (unificado)
scripts/logs/audit_all_2026-07-27_02-00-00.log    (log da execução)
```

> ⚠️ Relatórios com mais de **90 dias** são automaticamente removidos na próxima execução.

### Execução manual

```cmd
:: Batch (Task Scheduler)
F:\GITHUB\FintechBankApp\API\scripts\schtask_audit_all.bat

:: Ou via npm
cd F:\GITHUB\FintechBankApp\API
npm run audit:all
```

---

## Pré-requisitos (ambas as tarefas)

- Windows 10/11 ou Windows Server 2016+
- Node.js instalado (`C:\Program Files\nodejs\node.exe`)
- Banco de dados acessível via `.env` (arquivo em `API/.env`)
- PowerShell 5.1+ (para a tarefa de billing)

## Resolução de Problemas

| Problema | Causa Provável | Solução |
|:---------|:---------------|:--------|
| `Exit code 1` na validação | API offline | Verificar `node index.cjs` |
| `Exit code 1` na auditoria | BD offline | Verificar `.env` e conexão |
| Tarefa não executa | Notebook na bateria | Desmarcar "Iniciar apenas se estiver na CA" |
| Relatório não gerou | Permissão de escrita | Verificar permissões em `scripts/` |

## Logs Consolidados

```
API/scripts/logs/
├── billing_validate_2026-07-27_01-00-00.log    (validação diária)
├── billing_validate_2026-07-28_01-00-00.log
├── audit_all_2026-07-27_02-00-00.log           (auditoria semanal)
├── audit_all_2026-07-28_02-00-00.log
```

Logs com mais de **90 dias** são removidos automaticamente.
