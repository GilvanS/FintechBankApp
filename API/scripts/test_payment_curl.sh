# Token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcGYiOiIyMzczNjIxMTUwMyIsInJvbGUiOiJjdXN0b21lciIsImVtYWlsIjoiSGVucmkuUm9iaW5AaG90bWFpbC5mciIsImlhdCI6MTc4NTA3NjA2MSwiZXhwIjoxNzg1MTA0ODYxfQ.YClnt_tBw1lLNDenMnkbfvemj6vD-O2jsRQh_9MVhIc"

# Buscar dados do usuário
curl -s "http://localhost:3001/api/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cc = d.get('creditCard', {})
txs = cc.get('transactions', [])
payments = [t for t in txs if t.get('type') == 'PAYMENT']
others = [t for t in txs if t.get('type') != 'PAYMENT']
pay_sum = sum(abs(t.get('amount',0)) for t in payments)
other_sum = sum(abs(t.get('amount',0)) for t in others)

print()
print('═══════════════════════════════════════════════════════════')
print('  RESULTADO DO TESTE VIA CURL')
print('═══════════════════════════════════════════════════════════')
print()
print('📊 DADOS DO CREDIT CARD:')
print(f'  closedInvoice:           R$ {cc.get(\"closedInvoice\",0):>8,.2f}')
print(f'  currentInvoice:          R$ {cc.get(\"currentInvoice\",0):>8,.2f}')
print(f'  currentInvoiceTotal:     R$ {cc.get(\"currentInvoiceTotal\",0):>8,.2f}')
print(f'  currentInvoiceMinimo:    R$ {cc.get(\"currentInvoiceMinimo\",0):>8,.2f}')
print(f'  valorPago (invoice):     R$ {cc.get(\"_closedInvoiceValorPago\",0):>8,.2f}')
print()
print(f'📋 TRANSAÇÕES NA FATURA ABERTA:')
print(f'  Total: {len(txs)} transações')
print(f'  PAYMENT na lista:        {len(payments)}')
for p in payments:
    print(f'    → R$ {abs(p.get(\"amount\",0)):>8,.2f}  {p.get(\"merchant\",\"\")[:45]}  tipo: {p.get(\"paymentType\",\"-\")}')
print(f'  CREDIT/INSTALLMENT:      {len(others)}')
print(f'  Soma PAYMENT:            R$ {pay_sum:>8,.2f}')
print(f'  Soma sem PAYMENT:        R$ {other_sum:>8,.2f}')
print()
print('✅ VALIDAÇÃO:')
ci = cc.get('currentInvoice', 0)
if abs(ci - other_sum) < 0.01:
    print(f'  ✓ currentInvoice (R$ {ci:,.2f}) = soma sem PAYMENT (R$ {other_sum:,.2f})')
    print('  ✓ O PAYMENT NÃO inflou o currentInvoice!')
else:
    print(f'  ✗ INFLADO! currentInvoice (R$ {ci:,.2f}) ≠ soma sem PAYMENT (R$ {other_sum:,.2f})')
if len(payments) > 0:
    print(f'  ✓ {len(payments)} PAYMENT(s) visível(eis) na transactions[]!')
print()
print('📜 HISTÓRICO DE PAGAMENTOS:')
ph = cc.get('paymentHistory', [])
print(f'  {len(ph)} registro(s)')
for h in ph:
    print(f'    R$ {abs(h.get(\"amount\",0)):>8,.2f}  {h.get(\"description\",\"\")[:50]}  ({h.get(\"paymentType\",\"\")})')
print()
" 2>/dev/null
