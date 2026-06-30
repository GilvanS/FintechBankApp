import re

source = r'F:\GITHUB\FintechBankApp\WEB\new-base-fintechbank\src\components\HomeView.tsx'
dest = r'F:\GITHUB\FintechBankApp\WEB\components\HomeView.tsx'

with open(source, 'r', encoding='utf-8') as f:
    src_content = f.read()

# Extract 'Painel de Análise e Insights'
painel_start = src_content.find('{/* Central de Dashboards e Insights - Painel de Controle */}')
painel_end = src_content.find('</motion.section>', painel_start) + len('</motion.section>')
painel_jsx = src_content[painel_start:painel_end]

# Extract 'Aprenda mais'
aprenda_start = src_content.find('{/* "Aprenda mais" (Learn more) section')
aprenda_end = src_content.find('</motion.section>', aprenda_start) + len('</motion.section>')
aprenda_jsx = src_content[aprenda_start:aprenda_end]

# Replace brutalist styles
def debrutalize(jsx):
    jsx = re.sub(r'border-[24]\s+border-black', 'border border-black/5 dark:border-white/5', jsx)
    jsx = re.sub(r'shadow-\[.*?\]', 'shadow-sm', jsx)
    jsx = re.sub(r'text-black', 'text-zinc-900 dark:text-zinc-100', jsx)
    jsx = re.sub(r'bg-volt-surface', 'bg-white dark:bg-zinc-900', jsx)
    jsx = re.sub(r'isWidgetVisible\(\'.*?\'\) && \(', 'true && (', jsx)
    return jsx

painel_jsx = debrutalize(painel_jsx)
aprenda_jsx = debrutalize(aprenda_jsx)

with open(dest, 'r', encoding='utf-8') as f:
    dest_content = f.read()

# Inject into dest before '<NewsSection />'
injection_point = dest_content.find('<NewsSection />')
if injection_point != -1:
    new_content = dest_content[:injection_point] + painel_jsx + '\n\n' + aprenda_jsx + '\n\n' + dest_content[injection_point:]
    with open(dest, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Injected successfully!')
else:
    print('Injection point not found!')
