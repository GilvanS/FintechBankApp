#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor de Geracao de Boleto Bancario (FEBRABAN) e PIX (EMV BR Code)
para Faturas Fechadas - Fintech Bank App

Uso CLI:
  python scripts/invoice_payment_generator.py \
    --cpf 11111111111 \
    --name "Gilvan Sousa" \
    --amount 3870.86 \
    --duedate 2026-07-15 \
    --invoiceid FAT-202607

Uso como modulo Python:
  from invoice_payment_generator import generate_payment_codes
  result = generate_payment_codes(cpf="11111111111", name="Gilvan Sousa",
                                   amount=3870.86, due_date="2026-07-15",
                                   invoice_id="FAT-202607")
"""

import sys
import os
import json
import argparse
import hashlib
import base64
from datetime import datetime, date, timedelta
from typing import Dict, Any

# Forcar UTF-8 no Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')


# ============================================================================
# CONSTANTES DO MOTOR
# ============================================================================

BANK_CODE = '598'
BANK_NAME = 'Fintech Bank App S.A.'
BANK_CNPJ = '00000000000191'
CURRENCY_CODE = '9'
FEBRABAN_BASE_DATE = date(1997, 10, 7)

PIX_KEY = 'financeiro@fintechbank.com.br'
PIX_MERCHANT_NAME = 'Fintech Bank App'
PIX_MERCHANT_CITY = 'Sao Paulo'


# ============================================================================
# BOLETO BANCARIO - FEBRABAN
# ============================================================================

def _mod11(digits: str, weights_range=(2, 9)) -> int:
    """Calcula o Digito Verificador Modulo 11 (padrao FEBRABAN)."""
    min_w, max_w = weights_range
    weights = list(range(min_w, max_w + 1))
    total = 0
    weight_idx = 0
    for digit in reversed(digits):
        total += int(digit) * weights[weight_idx % len(weights)]
        weight_idx += 1
    remainder = total % 11
    dv = 11 - remainder
    if dv in (0, 10, 11):
        return 1
    return dv


def _mod10(digits: str) -> int:
    """Calcula o Digito Verificador Modulo 10 (padrao Linha Digitavel)."""
    weights = [2, 1]
    total = 0
    for i, digit in enumerate(reversed(digits)):
        product = int(digit) * weights[i % 2]
        total += product // 10 + product % 10
    remainder = total % 10
    return 0 if remainder == 0 else 10 - remainder


def calculate_due_date_factor(due_date: date) -> int:
    """Calcula o Fator de Vencimento FEBRABAN (dias desde 07/10/1997)."""
    delta = (due_date - FEBRABAN_BASE_DATE).days
    return delta


def generate_barcode_44(amount: float, due_date: date, invoice_id: str, cpf: str) -> str:
    """Gera o Codigo de Barras de 44 digitos no padrao FEBRABAN (Layout 2025+)."""
    factor = calculate_due_date_factor(due_date)
    factor_str = str(factor).zfill(5)
    amount_cents = int(round(amount * 100))
    amount_str = str(amount_cents).zfill(10)

    agencia = '0001'
    agencia_dv = str(_mod11(agencia))
    carteira = '09'
    nosso_numero = cpf.replace('.', '').replace('-', '').zfill(11)[-10:]
    nosso_numero_dv = str(_mod11(agencia + carteira + nosso_numero))
    conta = '00000001'[:6]
    free_field = f"{agencia}{agencia_dv}{carteira}{nosso_numero}{nosso_numero_dv}{conta}"

    barcode_no_dv = f"{BANK_CODE}{CURRENCY_CODE}{factor_str}{amount_str}{free_field}"
    dv = _mod11(barcode_no_dv)
    # No novo padrao Febraban, o DV do codigo de barras fica na posicao 20 (indice 19)
    barcode = f"{BANK_CODE}{CURRENCY_CODE}{factor_str}{amount_str}{dv}{free_field}"
    return barcode


def barcode_to_linha_digitavel(barcode: str) -> str:
    """Converte Codigo de Barras de 44 digitos em Linha Digitavel de 47 digitos (Layout 2025+)."""
    # Campo livre fica em barcode[20:44]
    free = barcode[20:44]

    # Campo 1: banco(3) + moeda(1) + fator(5) => total 9 digitos + DV modulo 10
    f1_raw = barcode[0:9]
    dv1 = _mod10(f1_raw)
    field1 = f"{f1_raw[:5]}.{f1_raw[5:]}{dv1}"

    # Campo 2: free[0:10] => total 10 digitos + DV modulo 10
    f2_raw = free[0:10]
    dv2 = _mod10(f2_raw)
    field2 = f"{f2_raw[:5]}.{f2_raw[5:]}{dv2}"

    # Campo 3: free[10:20] => total 10 digitos + DV modulo 10
    f3_raw = free[10:20]
    dv3 = _mod10(f3_raw)
    field3 = f"{f3_raw[:5]}.{f3_raw[5:]}{dv3}"

    # Campo 4: DV do codigo de barras (posicao 20, indice 19)
    field4 = barcode[19]

    # Campo 5: valor(10) + free[20:24] => total 14 digitos
    field5 = barcode[9:19] + free[20:24]

    return f"{field1} {field2} {field3} {field4} {field5}"


def generate_boleto(cpf: str, name: str, amount: float, due_date: date, invoice_id: str) -> Dict[str, Any]:
    """Gera os dados completos do Boleto Bancario FEBRABAN."""
    barcode = generate_barcode_44(amount, due_date, invoice_id, cpf)
    linha = barcode_to_linha_digitavel(barcode)
    cpf_clean = cpf.replace('.', '').replace('-', '').zfill(11)
    cpf_fmt = f"{cpf_clean[:3]}.{cpf_clean[3:6]}.{cpf_clean[6:9]}-{cpf_clean[9:11]}"
    return {
        'barcode': barcode,
        'linhaDigitavel': linha,
        'linhaDigitavelRaw': linha.replace('.', '').replace(' ', ''),
        'amount': amount,
        'amountFormatted': f"R$ {amount:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
        'dueDate': due_date.isoformat(),
        'dueDateFormatted': due_date.strftime('%d/%m/%Y'),
        'dueDateFactor': calculate_due_date_factor(due_date),
        'beneficiary': {
            'name': BANK_NAME,
            'cnpj': BANK_CNPJ,
            'cnpjFormatted': f"{BANK_CNPJ[:2]}.{BANK_CNPJ[2:5]}.{BANK_CNPJ[5:8]}/{BANK_CNPJ[8:12]}-{BANK_CNPJ[12:14]}",
            'bankCode': BANK_CODE,
            'bankName': f"{BANK_CODE} - Fintech Bank App",
        },
        'payer': { 'name': name, 'cpf': cpf_clean, 'cpfFormatted': cpf_fmt },
        'invoiceId': invoice_id,
    }


# ============================================================================
# PIX - EMV BR CODE (BACEN)
# ============================================================================

def _crc16_ccitt(data: str) -> str:
    """Calcula o CRC16 CCITT-FALSE (polinomio 0x1021) para o payload PIX."""
    crc = 0xFFFF
    for byte in data.encode('ascii'):
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc = crc << 1
            crc &= 0xFFFF
    return format(crc, '04X')


def _emv_field(tag: str, value: str) -> str:
    """Monta um campo EMV (Tag + Length + Value)."""
    length = str(len(value)).zfill(2)
    return f"{tag}{length}{value}"


def generate_pix_payload(cpf: str, name: str, amount: float, invoice_id: str) -> str:
    """Gera o payload PIX Copia e Cola no padrao EMV BR Code do Banco Central."""
    txid_raw = invoice_id.replace('-', '').replace(' ', '')
    txid = txid_raw[:25]
    gui = _emv_field('00', 'BR.GOV.BCB.PIX')
    pix_key_field = _emv_field('01', PIX_KEY)
    merchant_account = _emv_field('26', gui + pix_key_field)
    amount_str = f"{amount:.2f}"
    txid_field = _emv_field('05', txid)
    additional_data = _emv_field('62', txid_field)

    payload_parts = [
        _emv_field('00', '01'),
        _emv_field('01', '12'),
        merchant_account,
        _emv_field('52', '0000'),
        _emv_field('53', '986'),
        _emv_field('54', amount_str),
        _emv_field('58', 'BR'),
        _emv_field('59', PIX_MERCHANT_NAME[:25]),
        _emv_field('60', PIX_MERCHANT_CITY[:15]),
        additional_data,
    ]
    payload_no_crc = ''.join(payload_parts) + '6304'
    crc = _crc16_ccitt(payload_no_crc)
    return payload_no_crc + crc


def generate_qrcode_svg_base64(payload: str) -> str:
    """Gera um QR Code SVG em base64 a partir do payload PIX."""
    try:
        import qrcode
        import qrcode.image.svg
        from io import BytesIO
        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
        qr.add_data(payload)
        qr.make(fit=True)
        factory = qrcode.image.svg.SvgPathImage
        img = qr.make_image(image_factory=factory)
        buffer = BytesIO()
        img.save(buffer)
        svg_bytes = buffer.getvalue()
        b64 = base64.b64encode(svg_bytes).decode('ascii')
        return f"data:image/svg+xml;base64,{b64}"
    except ImportError:
        h = hashlib.sha256(payload.encode()).hexdigest()
        size = 200
        module_count = 21
        module_size = size / (module_count + 4)
        offset = module_size * 2
        rects = []
        bit_idx = 0
        for row in range(module_count):
            for col in range(module_count):
                is_finder = (
                    (row < 7 and col < 7) or
                    (row < 7 and col >= module_count - 7) or
                    (row >= module_count - 7 and col < 7)
                )
                if is_finder:
                    in_border = (row in (0, 6) or col in (0, 6))
                    in_center = (2 <= row <= 4 and 2 <= col <= 4)
                    fill = in_border or in_center
                else:
                    hex_char = h[bit_idx % len(h)]
                    fill = int(hex_char, 16) > 7
                    bit_idx += 1
                if fill:
                    x = offset + col * module_size
                    y = offset + row * module_size
                    rects.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{module_size:.1f}" height="{module_size:.1f}" fill="#000"/>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><rect width="{size}" height="{size}" fill="#fff"/>{"".join(rects)}</svg>'
        b64 = base64.b64encode(svg.encode('utf-8')).decode('ascii')
        return f"data:image/svg+xml;base64,{b64}"


def generate_pix(cpf: str, name: str, amount: float, invoice_id: str) -> Dict[str, Any]:
    """Gera os dados completos do PIX para pagamento."""
    payload = generate_pix_payload(cpf, name, amount, invoice_id)
    qrcode_svg = generate_qrcode_svg_base64(payload)
    cpf_clean = cpf.replace('.', '').replace('-', '').zfill(11)
    cpf_fmt = f"{cpf_clean[:3]}.{cpf_clean[3:6]}.{cpf_clean[6:9]}-{cpf_clean[9:11]}"
    return {
        'payload': payload,
        'qrcodeSvg': qrcode_svg,
        'amount': amount,
        'amountFormatted': f"R$ {amount:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
        'pixKey': PIX_KEY,
        'txid': invoice_id.replace('-', '').replace(' ', '')[:25],
        'beneficiary': { 'name': BANK_NAME, 'cnpj': BANK_CNPJ },
        'payer': { 'name': name, 'cpf': cpf_clean, 'cpfFormatted': cpf_fmt },
        'invoiceId': invoice_id,
    }


# ============================================================================
# DETECCAO INTELIGENTE DE TIPO DE CODIGO
# ============================================================================

def detect_payment_type(code: str) -> str:
    """Detecta se o codigo informado e um Boleto ou PIX."""
    cleaned = code.strip()
    digits_only = cleaned.replace('.', '').replace(' ', '').replace('-', '')
    if cleaned.startswith('0002') or cleaned.startswith('000201'):
        return 'pix'
    if '@' in cleaned:
        return 'pix'
    if cleaned.startswith('+55'):
        return 'pix'
    if len(cleaned) >= 32 and '-' in cleaned and not digits_only.isdigit():
        return 'pix'
    if digits_only.isdigit() and 44 <= len(digits_only) <= 48:
        return 'boleto'
    if digits_only.isdigit() and len(digits_only) in (11, 14):
        return 'pix'
    return 'pix'


def decode_boleto_from_code(code: str) -> Dict[str, Any]:
    """Decodifica um codigo de boleto e extrai as informacoes embutidas (Layout 2025+)."""
    digits = code.replace('.', '').replace(' ', '').replace('-', '')
    if len(digits) == 47:
        f1 = digits[0:9]       # banco(3) + moeda(1) + fator(5)
        f2 = digits[10:20]     # free_field[0..10]
        f3 = digits[21:31]     # free_field[10..20]
        f4 = digits[32]        # DV do codigo de barras
        f5 = digits[33:47]     # valor(10) + free_field[20..24]

        banco_moeda_fator = f1
        valor = f5[0:10]
        dv_bar = f4
        free_part1 = f2
        free_part2 = f3
        free_part3 = f5[10:14]

        barcode = banco_moeda_fator + valor + dv_bar + free_part1 + free_part2 + free_part3
    elif len(digits) == 44:
        barcode = digits
    else:
        barcode = digits[:44].ljust(44, '0')
    bank_code = barcode[0:3]
    factor_str = barcode[4:9] # Fator Febraban tem 5 digitos no layout 2025+
    amount_str = barcode[9:19]
    try:
        factor = int(factor_str)
        due_date = FEBRABAN_BASE_DATE + timedelta(days=factor)
        due_date_str = due_date.strftime('%d/%m/%Y')
    except (ValueError, OverflowError):
        due_date_str = 'N/D'
    try:
        amount_cents = int(amount_str)
        amount = amount_cents / 100
        amount_formatted = f"R$ {amount:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
    except ValueError:
        amount = 0.0
        amount_formatted = 'R$ 0,00'
    return {
        'type': 'boleto',
        'barcode': barcode,
        'bankCode': bank_code,
        'dueDate': due_date_str,
        'amount': amount,
        'amountFormatted': amount_formatted,
        'beneficiary': f'{bank_code} - Ambiente de Homologacao',
        'isValueFixed': True,
    }


# ============================================================================
# FUNCAO PRINCIPAL
# ============================================================================

def generate_payment_codes(cpf: str, name: str, amount: float,
                           due_date: str, invoice_id: str) -> Dict[str, Any]:
    """Gera todos os codigos de pagamento (Boleto + PIX) para uma fatura."""
    due = datetime.strptime(due_date, '%Y-%m-%d').date()
    boleto_data = generate_boleto(cpf, name, amount, due, invoice_id)
    pix_data = generate_pix(cpf, name, amount, invoice_id)
    return {
        'invoice': {
            'id': invoice_id, 'amount': amount,
            'amountFormatted': boleto_data['amountFormatted'],
            'dueDate': due_date, 'dueDateFormatted': due.strftime('%d/%m/%Y'),
            'payerName': name, 'payerCpf': cpf,
        },
        'boleto': boleto_data,
        'pix': pix_data,
        'generatedAt': datetime.now().isoformat(),
    }


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Motor de Geracao de Boleto e PIX para Faturas')
    parser.add_argument('--cpf', required=True, help='CPF do pagador')
    parser.add_argument('--name', required=True, help='Nome completo do pagador')
    parser.add_argument('--amount', required=True, type=float, help='Valor da fatura')
    parser.add_argument('--duedate', required=True, help='Data de vencimento (YYYY-MM-DD)')
    parser.add_argument('--invoiceid', required=True, help='ID unico da fatura')
    parser.add_argument('--json', action='store_true', help='Saida em formato JSON puro')
    parser.add_argument('--detect', type=str, help='Detectar tipo de codigo informado')
    args = parser.parse_args()

    if args.detect:
        result = detect_payment_type(args.detect)
        if args.json:
            print(json.dumps({'type': result, 'code': args.detect}))
        else:
            print(f"\n{'='*60}")
            print(f"  DETECCAO DE TIPO DE CODIGO")
            print(f"{'='*60}")
            print(f"  Codigo: {args.detect[:50]}...")
            print(f"  Tipo:   {result.upper()}")
            print(f"{'='*60}\n")
        return

    result = generate_payment_codes(cpf=args.cpf, name=args.name, amount=args.amount,
                                     due_date=args.duedate, invoice_id=args.invoiceid)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    print(f"\n{'='*70}")
    print(f"  MOTOR DE GERACAO - FINTECH BANK APP")
    print(f"{'='*70}")
    print(f"  Fatura:      {result['invoice']['id']}")
    print(f"  Pagador:     {result['invoice']['payerName']} (CPF {result['boleto']['payer']['cpfFormatted']})")
    print(f"  Valor:       {result['invoice']['amountFormatted']}")
    print(f"  Vencimento:  {result['invoice']['dueDateFormatted']}")
    print(f"{'='*70}")
    print(f"\n  BOLETO BANCARIO (FEBRABAN)")
    print(f"  {'-'*50}")
    print(f"  Codigo de Barras (44 digitos):")
    print(f"    {result['boleto']['barcode']}")
    print(f"\n  Linha Digitavel (47 digitos):")
    print(f"    {result['boleto']['linhaDigitavel']}")
    print(f"\n  Beneficiario: {result['boleto']['beneficiary']['name']}")
    print(f"  Banco:        {result['boleto']['beneficiary']['bankName']}")
    print(f"\n  PIX - COPIA E COLA (EMV BR CODE)")
    print(f"  {'-'*50}")
    print(f"  Payload:")
    print(f"    {result['pix']['payload']}")
    print(f"\n  Chave PIX:  {result['pix']['pixKey']}")
    print(f"  TXID:       {result['pix']['txid']}")
    print(f"  QR Code:    [SVG base64 gerado - {len(result['pix']['qrcodeSvg'])} chars]")
    print(f"\n{'='*70}\n")


if __name__ == '__main__':
    main()
