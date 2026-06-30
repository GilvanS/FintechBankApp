import re

def migrate_sections():
    new_base_path = r'F:\GITHUB\FintechBankApp\WEB\new-base-fintechbank\src\components\HomeView.tsx'
    target_path = r'F:\GITHUB\FintechBankApp\WEB\components\HomeView.tsx'

    with open(new_base_path, 'r', encoding='utf-8') as f:
        src = f.read()
    
    with open(target_path, 'r', encoding='utf-8') as f:
        target = f.read()

    # 1. Extract Painel de Análise e Insights
    m_painel = re.search(r'({\/\* Central de Dashboards e Insights - Painel de Controle \*\/}.*?<\/motion\.section>)', src, re.DOTALL)
    painel_content = m_painel.group(1) if m_painel else ""

    # 2. Extract Contas Recorrentes
    m_recorrentes = re.search(r'({\/\* Recurring Payments Section \*\/}.*?<\/motion\.section>)', src, re.DOTALL)
    recorrentes_content = m_recorrentes.group(1) if m_recorrentes else ""

    # 3. Extract Aprenda Mais
    m_aprenda = re.search(r'({\/\* "Aprenda mais".*?<\/motion\.section>)', src, re.DOTALL)
    aprenda_content = m_aprenda.group(1) if m_aprenda else ""

    # Transform styles to Neon Glassmorphism
    def transform_to_glass(text):
        text = re.sub(r'border-4 border-black', 'border border-white/5', text)
        text = re.sub(r'border-2 border-black', 'border border-white/5', text)
        text = re.sub(r'shadow-\[\d+px_\d+px_0px_0px_rgba\(0,0,0,1\)\]', 'shadow-2xl', text)
        text = re.sub(r'shadow-\[.*?\]', 'shadow-2xl', text)
        text = re.sub(r'text-black', 'text-white', text)
        text = re.sub(r'bg-white', 'bg-volt-surface', text)
        return text

    painel_glass = transform_to_glass(painel_content)
    recorrentes_glass = transform_to_glass(recorrentes_content)
    aprenda_glass = transform_to_glass(aprenda_content)

    # In target, we need to locate where to put these.
    # We will replace the current 'Aprenda Mais' with the new one.
    m_target_aprenda = re.search(r'({\/\* ── Aprenda Mais ──────────────────────────────── \*\/}.*?<\/motion\.section>)', target, re.DOTALL)
    if m_target_aprenda:
        target = target.replace(m_target_aprenda.group(1), aprenda_glass)

    # For Contas Recorrentes and Painel, let's insert Painel and Contas Recorrentes right before Banners & News
    m_target_banners = re.search(r'({\/\* ── Banners & News ──────────────────────────────── \*\/})', target)
    if m_target_banners:
        insert_block = painel_glass + "\n\n" + recorrentes_glass + "\n\n" + m_target_banners.group(1)
        target = target.replace(m_target_banners.group(1), insert_block)
    
    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(target)
    
    print(f"Migration complete! Painel found: {bool(m_painel)}, Recorrentes found: {bool(m_recorrentes)}, Aprenda found: {bool(m_aprenda)}")

if __name__ == '__main__':
    migrate_sections()