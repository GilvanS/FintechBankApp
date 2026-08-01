# Documentação Oficial de Regras, BINs e Validação de Cartões de Crédito

**Versão:** 2.0 · **Atualização:** 2026-07-22  
**Aplicação:** Antigravity Fintech App (Front-end `massGenerator.ts` + Back-end `cardEngine.js` e `usersRepo.js`)

---

## 1. Visão Geral

Este documento unifica e oficializa todas as regras de validação, padrões de formatação, faixas de BIN (*Bank Identification Number* / *Issuer Identification Number*) e especificação do **Algoritmo de Luhn** implementados na plataforma Fintech.

Todas as gerações de cartões (Massa 360°, cartões virtuais e cartões físicos emitidos) e validações de formulário do sistema devem obedecer rigorosamente a este documento.

---

## 2. Tabela Mestra de Bandeiras e Especificações de BIN

| Bandeira | Prefixos / Começa Com | Máximo de Números (Dígitos) | Tamanho CVV / CVC | Máscara / Formatação |
| :--- | :--- | :---: | :---: | :--- |
| **Visa** | `4` (Whitelist: `45767460`, `47660760`, `42031060`, `44466676`) | **13, 16, 19** (Padrão: 16) | **3** | `XXXX XXXX XXXX XXXX` |
| **Mastercard** | `51-55`, `2221-2720` (Whitelist: `54427460`, `53736360`, `51854460`, `53642660`) | **16** | **3** | `XXXX XXXX XXXX XXXX` |
| **Elo (Brasil)** | BINs específicos (`4011`, `4312`, `4389`, `4514`, `4573`, `4576`, `4984`, `5041`, `5066`, `5067`, `5090`, `6277`, `6362`, `6363`, `6500`, `6504`, `6505`, `6507`, `6509`, `6516`, `6550`) | **16** | **3** | `XXXX XXXX XXXX XXXX` |
| **American Express (Amex)** | `34`, `37` (Whitelist: `37828000`, `37148000`, `34008000`, `37878000`) | **15** | **4** | `XXXX XXXXXX XXXXX` |
| **Diners Club / Carte Blanche** | `300-305`, `3095`, `36`, `38-39` | **14, 16** | **3** | `XXXX XXXXXX XXXX` (14) / `XXXX XXXX XXXX XXXX` (16) |
| **Discover** | `6011`, `622126-622925`, `644-649`, `65` | **16** | **4** | `XXXX XXXX XXXX XXXX` |
| **Hipercard (Brasil)** | `384100`, `384140`, `384160`, `606281`, `637095`, `637612`, `637599`, `637609`, `637568` | **13, 16, 19** | **3** | `XXXX XXXX XXXX XXXX` |
| **JCB (Japão)** | `3528-3589` | **16** | **3** | `XXXX XXXX XXXX XXXX` |
| **Aura** | `50` | **16** | **3** | `XXXX XXXX XXXX XXXX` |
| **UnionPay (China)** | `62` | **16, 19** | **3** | `XXXX XXXX XXXX XXXX` |

---

## 3. Expressões Regulares (Regex) Oficiais para Validação

### 3.1 Elo (Cielo / Bandeira Elo Oficial)
```regex
^(4011(78|79)|43(1274|8935)|45(1416|7393|763(1|2))|50(4175|6699|67[0-7][0-9]|9000)|627780|63(6297|6368)|650(03([^4])|04([0-9])|05(0|1)|4(0[5-9]|3[0-9]|8[5-9]|9[0-9])|5([0-2][0-9]|3[0-8])|9([2-6][0-9]|7[0-8])|541|700|720|901)|651652|655000|655021)
```

### 3.2 Mastercard (Ranges 51-55 e 2221-2720)
```regex
^5[1-5]|^2(2(2[1-9]|[3-9])|[3-6]|7([01]|20))
```

### 3.3 Hipercard
```regex
^(((637095)|(637612)|(637599)|(637609)|(637568))\d{0,10})$
```

### 3.4 American Express (Amex)
```regex
^3[47][0-9]{13}$
```

### 3.5 Visa
```regex
^4[0-9]{12}(?:[0-9]{3})?$
```

---

## 4. Algoritmo de Luhn (Hans Peter Luhn - IBM 1954)

Todos os cartões gerados e validados na plataforma cumprem a verificação matemática de **Luhn**:

1. Percorrer os dígitos da direita para a esquerda.
2. A cada 2 dígitos (posições ímpares a partir da direita), dobrar o valor digitado.
3. Se o resultado for maior que 9 (ex: 7 × 2 = 14), subtrair 9 (14 - 9 = 5).
4. Somar todos os números resultantes.
5. Se o total for divisível por 10 (`soma % 10 === 0`), o número é **matematicamente válido**.

---

## 5. Segurança e Privacidade de Dados de Cartão

- **BIN público**: Os 6 ou 8 primeiros dígitos identificam apenas o banco emissor e produto (ex: Gold, Black, Platinum, Débito). Podem ser compartilhados com serviços de antifraude e armazenados no banco.
- **Dados Sensíveis Não Armazenados em Texto Puro**: O CVV/CVC e a senha (PIN) de cartões reais de produção nunca devem ser salvos sem criptografia. No ambiente de simulação/mock, os cartões salvam hash e máscaras seguras.
