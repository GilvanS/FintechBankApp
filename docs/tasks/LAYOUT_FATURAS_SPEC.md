# Especificação de Layout: Faturas (Invoices)

Este documento foi gerado com base na análise visual de telas de alta fidelidade (mockups) para orientar a implementação e revisão por IA (ex: Claude).

**Skills utilizadas para guiar esta análise:**
- `mobile-design`: Para identificar padrões nativos de navegação e componentes mobile-first.
- `ui-ux-designer` / `frontend-design`: Para extrair com precisão a hierarquia visual, espaçamentos (padding/margins), sombras (elevation) e tipografia (pesos e contrastes).
- `ui-skills`: Para definir as regras de componentização (ex: list items flex-row, accordions).

---

## 1. Header e Navegação Temporal (Topo)
- **Header Base:** Fundo com a cor primária da marca (`bg-primary`). Título centralizado "Fatura" em cor de contraste (ex: branco para fundos escuros/vibrantes, fonte semi-bold). Seta de navegação nativa de "voltar" alinhada à esquerda.
- **Barra de Seleção de Meses (Carrossel Horizontal):**
  - Fundo da barra: Cor primária (`bg-primary`).
  - Textos dos meses: "Fev", "Mar", "Abr" (ativo), "Mai", "Jun", "Jul".
  - Estilo de Mês inativo: Cor de alto contraste com opacidade reduzida (ex: branco 60%).
  - Estilo de Mês ativo: Cor de alto contraste com 100% opacidade e um indicador visual forte (sublinhado espesso de ponta a ponta posicionado abaixo do texto do mês).
  - Comportamento: Scroll horizontal suave (*snap to item* ativado).

## 2. Card Principal de Resumo (O "Boleto" do Mês)
- **Estilo do Card:** Fundo de superfície escuro ou claro (conforme o tema do app, ex: `bg-surface-dark` ou branco), bordas arredondadas (radius de aprox. 16px), padding interno generoso (20px a 24px), e uma sombra sutil (box-shadow) para criar elevação (elevação z) destacando-o do fundo da tela.
- **Cabeçalho do Card (Status):** Tag/Pill indicando o status "A fatura está fechada" com ícone de "check". O fundo da tag deve usar um tom muito claro/pastel da cor de sucesso (ex: verde) para contraste semântico.
- **Valor Principal:**
  - Label superior: "Valor total" em tom neutro ou cinza (`text-subtle-dark`).
  - Valor nominal: Tipografia super destacada (H1/H2), em negrito (ex: "R$ 12.781,50", cor de texto padrão).
  - Acessibilidade Visual: Ícone de "Olho" alinhado à direita do valor para permitir alternar entre mostrar/ocultar dados sensíveis.
- **Detalhes Secundários (Grid de 2 Colunas):** 
  - Coluna Esquerda: "Vence em 04/05" (Label descritivo em tom neutro, data em texto base semi-bold).
  - Coluna Direita: "Pagamento mínimo" (Label descritivo) com o valor nominal "R$ 1.916,04" disposto logo abaixo.
- **Call to Action (CTA Principal):** Botão "Pagar fatura". Largura cobrindo 100% do container do card interno, altura de toque padrão (touch target de aprox. 48px), cor de fundo primária (`bg-primary`), texto centralizado em negrito, bordas arredondadas (aprox. 8px).

## 3. Tratamento de Estados Específicos (Edge Cases)
- **Saldo Credor / Fatura Negativa:** 
  - Quando o saldo calculado for negativo (ex: "R$ -81,77"), a cor tipográfica do valor monetário muda para a cor de sucesso ou primária (`text-primary` ou verde), comunicando crédito.
  - A mensagem principal da tag de status é substituída por "Não há fatura para pagar neste mês".
  - A interface deve ocultar ou desabilitar o botão primário de pagamento (`bg-primary`), pois a ação não é aplicável.

## 4. Seção de Lançamentos (Timeline de Transações)
- **Subtítulo Auxiliar:** Um texto de instrução acima da lista: "Confira aqui os detalhes da fatura e os lançamentos do mês." (Tom neutro menor).
- **Agrupamentos Temporais:** Headers de seção separando as compras (ex: "Total do Titular" ou por dias). Recomenda-se headers com comportamento sticky.
- **Item de Transação (List Item Padrão):**
  - Layout Base: `Flex-row` com `align-items: center` e `justify-content: space-between`.
  - **Ícone à Esquerda:** Círculo com background leve (`bg-primary/10`) contendo o ícone representativo da categoria da compra.
  - **Bloco de Texto Central:** Título principal (nome do estabelecimento comercial) posicionado no topo. Subtítulo com a data ou hora da transação posicionado logo abaixo em tom mais fraco.
  - **Tags Secundárias:** Caso seja uma compra parcelada, exibir uma tag compacta indicativa como "(1/2)".
  - **Valor à Direita:** Ancorado no extremo direito da linha, texto em negrito (para transações de débito padrão) ou na cor primária/verde (para estornos ou descontos).

## 5. Expansão de Detalhes da Transação (Accordion Collapse)
- Interação: Tocar em um item da lista engatilha uma animação de expansão revelando dados extras de metadados da transação.
- **Conteúdo do Box Expandido:**
  - Estilização: Fundo com variação leve de tom (ex: `bg-surface-dark/50`) para demarcar visualmente o sub-nível em relação à transação "pai".
  - Layout: Múltiplas linhas em chave-valor (Flex row, `space-between`).
  - *Dado 1 - Valor de Origem:* Moeda estrangeira em que a compra foi lançada (ex: "US$ 10,00").
  - *Dado 2 - Cotação do Dólar:* Taxa PTAX + spread aplicada no dia da conversão (ex: "R$ 4,90").
  - *Dado 3 - IOF:* Custo do imposto calculado sobre a operação.
  - Divisórias em linha muito sutis dividindo as linhas de dados para facilitar a leitura.

## 6. Rodapé da Lista (Totalizadores)
- Exibe a consolidação das obrigações daquele escopo.
- Layout: Uma linha divisória acentuada no topo, o texto "Total do Titular" em fonte semi-bold alinhado à esquerda, e a somatória final posicionada à direita com destaque visual adequado.
