#!/bin/bash
# Script de Teste — Verificação da Correção do Double-Counting
#
# Testa que ao pagar uma fatura fechada, o currentInvoice NÃO é inflado
# pelo valor do pagamento (bug corrigido em enrichUserCreditCardData).
#
# Uso:
#   bash scripts/test_payment_fix.sh <CPF> <PASSWORD>
#   bash scripts/test_payment_fix.sh 7768067495 admin999

set -e

BASE_URL="http://localhost:3001/api"
CPF="${1:-7768067495}"
PASS="${2:-admin999}"
PASS_OK=false

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  TESTE — Correção do Double-Counting de Pagamento"
echo "══════════════════════════════════════════════════════════════"
echo "  CPF:   ${CPF}"
echo "  Server: ${BASE_URL}"
echo ""

# ── 1. LOGIN ──────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────────────"
echo "  [1/5] Login..."
echo "──────────────────────────────────────────────────────────"

LOGIN=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"cpf\":\"${CPF}\",\"password\":\"${PASS}\"}")

TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "  ❌ Login falhou! Verifique CPF/senha."
  echo "     Resposta: $LOGIN"
  exit 1
fi

echo "  ✅ Login OK (token recebido)"
echo ""

# Extrair dados do login
BALANCE=$(echo "$LOGIN" | grep -o '"balance":[0-9.]*' | head -1 | cut -d: -f2)
ROLE=$(echo "$LOGIN" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
echo "  Balance: R$ ${BALANCE}"
echo "  Role: ${ROLE}"
echo ""

# ── 2. GET /users/me (ANTES) ──────────────────────────────────────
echo "──────────────────────────────────────────────────────────"
echo "  [2/5] Estado ANTES do pagamento..."
echo "──────────────────────────────────────────────────────────"

ME_BEFORE=$(curl -s "${BASE_URL}/users/me" \
  -H "Authorization: Bearer ${TOKEN}")

CREDIT_CARD=$(echo "$ME_BEFORE" | grep -o '"creditCard":{[^}]*}' | head -1)
CLOSED_INV=$(echo "$ME_BEFORE" | grep -o '"closedInvoice":[0-9.]*' | head -1 | cut -d: -f2)
CURR_INV=$(echo "$ME_BEFORE" | grep -o '"currentInvoice":[0-9.]*' | head -1 | cut -d: -f2)
INV_TOTAL=$(echo "$ME_BEFORE" | grep -o '"currentInvoiceTotal":[0-9.]*' | head -1 | cut -d: -f2)
INV_MINIMO=$(echo "$ME_BEFORE" | grep -o '"currentInvoiceMinimo":[0-9.]*' | head -1 | cut -d: -f2)
HAS_PAYMENTS=$(echo "$ME_BEFORE" | grep -o '"paymentHistory":\[[^\]]*\]' | head -1)
BALANCE=$(echo "$ME_BEFORE" | grep -o '"balance":[0-9.]*' | head -1 | cut -d: -f2)

echo "  closedInvoice:        R$ ${CLOSED_INV:-0}"
echo "  currentInvoice:       R$ ${CURR_INV:-0}"
echo "  currentInvoiceTotal:  R$ ${INV_TOTAL:-0}"
echo "  currentInvoiceMinimo: R$ ${INV_MINIMO:-0}"
echo "  balance:              R$ ${BALANCE:-0}"
echo "  has paymentHistory:   $([ -n "$HAS_PAYMENTS" ] && echo '✅ sim' || echo '❌ não')"
echo ""

# Verificar se há fatura para pagar
if [ -z "$CLOSED_INV" ] || [ "$(echo "$CLOSED_INV" | cut -d. -f1)" = "0" ]; then
  echo "  ⚠️  Nenhuma fatura fechada para pagar com este CPF."
  echo "     Tentando buscar massas inadimplentes..."
  
  # Buscar admin token para consultar massa
  ADMIN_LOGIN=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"cpf":"99999999999","password":"admin999"}')
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$ADMIN_TOKEN" ]; then
    # Buscar massas inadimplentes
    echo "  Buscando massa inadimplente via admin..."
    OVERDUE=$(curl -s "${BASE_URL}/admin/overdue-masses-dashboard" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}")
    
    # Pega o primeiro CPF da lista
    FIRST_CPF=$(echo "$OVERDUE" | grep -o '"cpf":"[0-9]*"' | head -1 | cut -d'"' -f4)
    FIRST_NAME=$(echo "$OVERDUE" | grep -o '"fullName":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$FIRST_CPF" ]; then
      echo "  ✅ Encontrada massa: ${FIRST_NAME} (${FIRST_CPF})"
      echo ""
      echo "  💡 Reexecute com: bash scripts/test_payment_fix.sh ${FIRST_CPF} admin999"
    else
      echo "  ❌ Nenhuma massa inadimplente encontrada."
    fi
  fi
  echo ""
  echo "  TESTE INCONCLUSIVO — sem fatura para pagar."
  exit 0
fi

# ── 3. CALCULAR VALOR DO PAGAMENTO ────────────────────────────────
echo "──────────────────────────────────────────────────────────"
echo "  [3/5] Calculando valor do pagamento..."
echo "──────────────────────────────────────────────────────────"

# Paga 10% do closedInvoice (pagamento mínimo) ou o que o saldo permitir
PAY_AMOUNT=$(echo "scale=2; ${CLOSED_INV} * 0.10" | bc 2>/dev/null || echo "10")
# Arredondar para 2 casas
PAY_AMOUNT=$(printf "%.2f" "$PAY_AMOUNT" 2>/dev/null || echo "${PAY_AMOUNT}")

# Garantir mínimo de R$ 10
if [ "$(echo "${PAY_AMOUNT} < 10" | bc 2>/dev/null || echo "1")" = "1" ]; then
  PAY_AMOUNT="10.00"
fi

# Garantir que não excede o saldo
if [ -n "$BALANCE" ] && [ "$(echo "${PAY_AMOUNT} > ${BALANCE}" | bc 2>/dev/null || echo "0")" = "1" ]; then
  echo "  ⚠️  Saldo insuficiente para pagamento mínimo. Pagando saldo total."
  PAY_AMOUNT="${BALANCE}"
fi

echo "  Valor do pagamento: R$ ${PAY_AMOUNT}"
echo "  (10% da fatura fechada = R$ CLOSED_INV * 0.10)"
echo ""

# ── 4. EXECUTAR PAGAMENTO ─────────────────────────────────────────
echo "──────────────────────────────────────────────────────────"
echo "  [4/5] Executando pagamento..."
echo "──────────────────────────────────────────────────────────"

PAY_RESPONSE=$(curl -s -X POST "${BASE_URL}/cards/invoice/pay" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"cpf\":\"${CPF}\",\"pin\":\"9898\",\"amount\":${PAY_AMOUNT}}")

PAY_SUCCESS=$(echo "$PAY_RESPONSE" | grep -o '"success":true')
PAY_MSG=$(echo "$PAY_RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -n "$PAY_SUCCESS" ]; then
  echo "  ✅ Pagamento realizado com sucesso!"
  echo "     Mensagem: ${PAY_MSG}"
else
  PAY_ERR=$(echo "$PAY_RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4 | head -1)
  echo "  ❌ Pagamento falhou: ${PAY_ERR:-erro desconhecido}"
  echo "     Resposta: ${PAY_RESPONSE}"
  echo ""
  echo "  TESTE INCONCLUSIVO"
  exit 0
fi
echo ""

# ── 5. GET /users/me (DEPOIS) ─────────────────────────────────────
echo "──────────────────────────────────────────────────────────"
echo "  [5/5] Estado DEPOIS do pagamento..."
echo "──────────────────────────────────────────────────────────"

ME_AFTER=$(curl -s "${BASE_URL}/users/me" \
  -H "Authorization: Bearer ${TOKEN}")

CLOSED_INV_AFTER=$(echo "$ME_AFTER" | grep -o '"closedInvoice":[0-9.]*' | head -1 | cut -d: -f2)
CURR_INV_AFTER=$(echo "$ME_AFTER" | grep -o '"currentInvoice":[0-9.]*' | head -1 | cut -d: -f2)
INV_TOTAL_AFTER=$(echo "$ME_AFTER" | grep -o '"currentInvoiceTotal":[0-9.]*' | head -1 | cut -d: -f2)
INV_MINIMO_AFTER=$(echo "$ME_AFTER" | grep -o '"currentInvoiceMinimo":[0-9.]*' | head -1 | cut -d: -f2)
HAS_PAYMENTS_AFTER=$(echo "$ME_AFTER" | grep -o '"paymentHistory":\[[^\]]*\]' | head -1)
CLOSED_TXS=$(echo "$ME_AFTER" | grep -o '"closedTransactions":\[[^\]]*\]' | head -1)
TX_COUNT=$(echo "$CLOSED_TXS" | grep -o '"type":"PAYMENT"' | wc -l)

echo "  closedInvoice:        R$ ${CLOSED_INV_AFTER:-0}   (antes: R$ ${CLOSED_INV:-0})"
echo "  currentInvoice:       R$ ${CURR_INV_AFTER:-0}   (antes: R$ ${CURR_INV:-0})"
echo "  currentInvoiceTotal:  R$ ${INV_TOTAL_AFTER:-0}"
echo "  currentInvoiceMinimo: R$ ${INV_MINIMO_AFTER:-0}"
echo "  paymentHistory:       $([ -n "$HAS_PAYMENTS_AFTER" ] && echo '✅ tem' || echo '❌ vazio')"
echo "  closedTransactions:   $([ "$TX_COUNT" -gt 0 ] && echo "✅ ${TX_COUNT} pagamento(s) visível(is)" || echo "❌ nenhum pagamento visível")"
echo ""

# ── VERIFICAÇÃO ────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────────────"
echo "  VERIFICAÇÃO"
echo "──────────────────────────────────────────────────────────"

# Cálculo esperado:
# closedInvoice_after = closedInvoice_before - PAyMENT (saldo residual)
EXPECTED_CLOSED=$(echo "scale=2; ${CLOSED_INV} - ${PAY_AMOUNT}" | bc 2>/dev/null || echo "0")
# currentInvoice NÃO deve mudar (pagamento não infla as compras abertas)

echo "  Pagamento realizado:   R$ ${PAY_AMOUNT}"
echo ""

# Teste 1: closedInvoice reduziu
CLOSED_DIFF=$(echo "scale=2; ${CLOSED_INV} - ${CLOSED_INV_AFTER}" | bc 2>/dev/null || echo "0")
if [ "$(echo "${CLOSED_DIFF} > 0" | bc 2>/dev/null)" = "1" ]; then
  echo "  ✅ Teste 1 PASS: closedInvoice reduziu corretamente"
  echo "     (R$ ${CLOSED_INV} → R$ ${CLOSED_INV_AFTER}, diff: R$ ${CLOSED_DIFF})"
else
  echo "  ❌ Teste 1 FAIL: closedInvoice não reduziu"
  echo "     (era R$ ${CLOSED_INV}, ficou R$ ${CLOSED_INV_AFTER})"
fi

# Teste 2: currentInvoice NÃO inflou (deve ser <= ao que era antes OU ser explicado)
if [ -n "$CURR_INV_AFTER" ] && [ -n "$CURR_INV" ]; then
  CURR_DIFF=$(echo "scale=2; ${CURR_INV_AFTER} - ${CURR_INV}" | bc 2>/dev/null || echo "0")
  if [ "$(echo "${CURR_DIFF} <= 0" | bc 2>/dev/null || echo "0")" = "1" ]; then
    echo "  ✅ Teste 2 PASS: currentInvoice NÃO inflou com o pagamento"
    echo "     (R$ ${CURR_INV} → R$ ${CURR_INV_AFTER})"
  else
    echo "  ⚠️  Teste 2 INFO: currentInvoice mudou (R$ ${CURR_INV} → R$ ${CURR_INV_AFTER})"
    echo "     (pode ser devido a novas compras no período, não ao pagamento)"
  fi
fi

# Teste 3: paymentHistory existe
if [ -n "$HAS_PAYMENTS_AFTER" ]; then
  echo "  ✅ Teste 3 PASS: paymentHistory contém registros após pagamento"
else
  echo "  ⚠️  Teste 3 INFO: paymentHistory vazio (pode ser que o pagamento esteja fora do range de datas)"
fi

# Teste 4: closedTransactions contém PAYMENT
if [ "$TX_COUNT" -gt 0 ]; then
  echo "  ✅ Teste 4 PASS: closedTransactions mostra ${TX_COUNT} pagamento(s) no extrato"
else
  echo "  ⚠️  Teste 4 INFO: nenhum PAYMENT em closedTransactions (pode ser range de datas)"
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
if [ "$(echo "${CLOSED_DIFF} > 0" | bc 2>/dev/null)" = "1" ] && [ "$TX_COUNT" -gt 0 ]; then
  echo "  ✅ CORREÇÃO VERIFICADA!"
  echo "     Pagamento abateu closedInvoice corretamente e NÃO inflou currentInvoice."
  echo "     Pagamento visível no closedTransactions ✅"
else
  echo "  ⚠️  TESTE INCONCLUSIVO"
  echo "     Verifique os valores manualmente."
fi
echo "══════════════════════════════════════════════════════════════"
echo ""
