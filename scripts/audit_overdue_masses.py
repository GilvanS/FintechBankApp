#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audit Overdue Test Masses Script
Audita as massas de teste do Fintech Bank App e calcula inadimplência e encargos acumulados.
"""

import os
import sys
import json
from datetime import datetime

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def compute_charges(closed_val, days_overdue):
    if closed_val <= 0 or days_overdue <= 0:
        return {
            'multa': 0.0,
            'juros_mora': 0.0,
            'juros_remuneratorios': 0.0,
            'iof': 0.0,
            'total_encargos': 0.0,
            'total_quitacao': closed_val
        }
    
    multa = round(closed_val * 0.02, 2)
    juros_mora = round(closed_val * 0.000333 * days_overdue, 2)
    juros_rem = round(closed_val * 0.00513 * days_overdue, 2)
    iof_fixo = round(closed_val * 0.0038, 2)
    iof_diario = round(closed_val * 0.000082 * days_overdue, 2)
    iof = round(iof_fixo + iof_diario, 2)
    
    total_encargos = round(multa + juros_mora + juros_rem + iof, 2)
    total_quitacao = round(closed_val + total_encargos, 2)
    
    return {
        'multa': multa,
        'juros_mora': juros_mora,
        'juros_remuneratorios': juros_rem,
        'iof': iof,
        'total_encargos': total_encargos,
        'total_quitacao': total_quitacao
    }

def generate_audit_report():
    print("=" * 70)
    print(" 📊 FINTECH BANK APP - AUDITORIA DE MASSAS EM ATRASO (PYTHON)")
    print("=" * 70)
    
    # Massas de Teste Cadastradas no Banco/Sistema (20 Massas)
    masses = [
        { 'cpf': '11111111111', 'full_name': 'Gilvan Sousa', 'account_status': 'inadimplente', 'closed_invoice_amount': 3870.86, 'days_overdue': 9, 'due_date': '2026-07-15' },
        { 'cpf': '22222222222', 'full_name': 'Maria Oliveira Santos', 'account_status': 'inadimplente', 'closed_invoice_amount': 1450.00, 'days_overdue': 14, 'due_date': '2026-07-10' },
        { 'cpf': '33333333333', 'full_name': 'Carlos Eduardo Pereira', 'account_status': 'inadimplente', 'closed_invoice_amount': 5200.00, 'days_overdue': 19, 'due_date': '2026-07-05' },
        { 'cpf': '44444444444', 'full_name': 'Ana Beatriz Lima', 'account_status': 'inadimplente', 'closed_invoice_amount': 890.50, 'days_overdue': 6, 'due_date': '2026-07-18' },
        { 'cpf': '55555555555', 'full_name': 'Roberto da Silva Junior', 'account_status': 'inadimplente', 'closed_invoice_amount': 2750.30, 'days_overdue': 29, 'due_date': '2026-06-25' },
        { 'cpf': '66666666666', 'full_name': 'Fernanda Costa Ribeiro', 'account_status': 'inadimplente', 'closed_invoice_amount': 4120.00, 'days_overdue': 12, 'due_date': '2026-07-12' },
        { 'cpf': '77777777777', 'full_name': 'Lucas Gabriel Martins', 'account_status': 'inadimplente', 'closed_invoice_amount': 6300.75, 'days_overdue': 45, 'due_date': '2026-06-09' },
        { 'cpf': '88888888888', 'full_name': 'Juliana Barbosa Rocha', 'account_status': 'inadimplente', 'closed_invoice_amount': 950.00, 'days_overdue': 3, 'due_date': '2026-07-21' },
        { 'cpf': '99999999999', 'full_name': 'Thiago Henrique Alves', 'account_status': 'inadimplente', 'closed_invoice_amount': 7840.20, 'days_overdue': 60, 'due_date': '2026-05-25' },
        { 'cpf': '12345678901', 'full_name': 'Camila Fernandes Rodrigues', 'account_status': 'inadimplente', 'closed_invoice_amount': 1890.00, 'days_overdue': 21, 'due_date': '2026-07-03' },
        { 'cpf': '23456789012', 'full_name': 'Gabriel Augusto Mendes', 'account_status': 'inadimplente', 'closed_invoice_amount': 3400.00, 'days_overdue': 8, 'due_date': '2026-07-16' },
        { 'cpf': '34567890123', 'full_name': 'Larissa Nogueira Castro', 'account_status': 'inadimplente', 'closed_invoice_amount': 2150.60, 'days_overdue': 17, 'due_date': '2026-07-07' },
        { 'cpf': '45678901234', 'full_name': 'Bruno Vinicius Carvalho', 'account_status': 'inadimplente', 'closed_invoice_amount': 9450.00, 'days_overdue': 33, 'due_date': '2026-06-21' },
        { 'cpf': '56789012345', 'full_name': 'Patricia Gomes de Oliveira', 'account_status': 'inadimplente', 'closed_invoice_amount': 1200.00, 'days_overdue': 5, 'due_date': '2026-07-19' },
        { 'cpf': '67890123456', 'full_name': 'Felipe Augusto Ramos', 'account_status': 'inadimplente', 'closed_invoice_amount': 3990.80, 'days_overdue': 25, 'due_date': '2026-06-29' },
        { 'cpf': '78901234567', 'full_name': 'Vanessa Cristina Cardoso', 'account_status': 'inadimplente', 'closed_invoice_amount': 8120.40, 'days_overdue': 50, 'due_date': '2026-06-04' },
        { 'cpf': '89012345678', 'full_name': 'Diego Armando Silva', 'account_status': 'inadimplente', 'closed_invoice_amount': 680.00, 'days_overdue': 2, 'due_date': '2026-07-22' },
        { 'cpf': '90123456789', 'full_name': 'Aline Moreira Dias', 'account_status': 'inadimplente', 'closed_invoice_amount': 4780.00, 'days_overdue': 11, 'due_date': '2026-07-13' },
        { 'cpf': '01234567890', 'full_name': 'Marcelo Antonio Souza', 'account_status': 'inadimplente', 'closed_invoice_amount': 2330.90, 'days_overdue': 16, 'due_date': '2026-07-08' },
        { 'cpf': '12312312312', 'full_name': 'Renata Aparecida Nunes', 'account_status': 'inadimplente', 'closed_invoice_amount': 5890.00, 'days_overdue': 40, 'due_date': '2026-06-14' }
    ]
    
    total_users = len(masses)
    overdue_masses = [m for m in masses if m['closed_invoice_amount'] > 0 and m['days_overdue'] > 0]
    overdue_count = len(overdue_masses)
    
    report_items = []
    grand_total_debt = 0.0
    
    for mass in overdue_masses:
        charges = compute_charges(mass['closed_invoice_amount'], mass['days_overdue'])
        item = {
            'cpf': mass['cpf'],
            'full_name': mass['full_name'],
            'status': mass['account_status'],
            'fatura_fechada': mass['closed_invoice_amount'],
            'dias_atraso': mass['days_overdue'],
            'data_vencimento': mass['due_date'],
            'encargos': charges,
            'total_quitacao': charges['total_quitacao']
        }
        report_items.append(item)
        grand_total_debt += charges['total_quitacao']
    
    summary = {
        'timestamp': datetime.now().isoformat(),
        'total_massas': total_users,
        'massas_em_atraso': overdue_count,
        'taxa_inadimplencia_pct': round((overdue_count / total_users) * 100, 2) if total_users > 0 else 0.0,
        'valor_total_inadimplente': round(grand_total_debt, 2),
        'dias_medio_atraso': round(sum(m['days_overdue'] for m in overdue_masses) / overdue_count, 1) if overdue_count > 0 else 0,
        'detalhes': report_items
    }
    
    print(f"Total de Massas de Teste : {summary['total_massas']}")
    print(f"Massas em Atraso        : {summary['massas_em_atraso']} ({summary['taxa_inadimplencia_pct']}%)")
    print(f"Montante Total a Quitar  : R$ {summary['valor_total_inadimplente']:,.2f}".replace('.', 'X').replace(',', '.').replace('X', ','))
    print(f"Média de Dias em Atraso  : {summary['dias_medio_atraso']} dias")
    print("-" * 70)
    print("DETALHAMENTO POR MASSA:")
    for idx, item in enumerate(report_items, 1):
        print(f"[{idx}] CPF: {item['cpf']} | Nome: {item['full_name']}")
        print(f"    - Fatura Vencida : R$ {item['fatura_fechada']:,.2f}")
        print(f"    - Dias de Atraso : {item['dias_atraso']} dias (Vencimento: {item['data_vencimento']})")
        print(f"    - Encargos Totais: R$ {item['encargos']['total_encargos']:,.2f} (Multa R$ {item['encargos']['multa']} | Mora R$ {item['encargos']['juros_mora']} | Remun R$ {item['encargos']['juros_remuneratorios']} | IOF R$ {item['encargos']['iof']})")
        print(f"    - Total Quitação : R$ {item['total_quitacao']:,.2f}")
        print("-" * 70)
        
    return summary

if __name__ == '__main__':
    res = generate_audit_report()
    out_dir = os.path.dirname(__file__)
    json_path = os.path.join(out_dir, 'overdue_masses_report.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    print(f"Relatório exportado com sucesso em: {json_path}")
