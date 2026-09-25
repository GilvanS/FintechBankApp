// massMerchants.js — merchants e preços do Gerador de Massa 4.0. Extraído de
// massBilling.js (M-3, Task 5) só para manter esse arquivo abaixo de 500 linhas; sem
// dependência de banco, só constantes e sorteio.

// Merchants do gerador de massa. Compras em merchant INTERNACIONAL carregam IOF
// de câmbio fixo (6,38%, sem componente diário), somado ao IOF doméstico da
// fatura em atraso (0,38% fixo + 0,0082%/dia).
// Assinaturas (Netflix/Spotify/Crunchyroll) saíram da lista NACIONAL geral —
// entram só na compra À VISTA (SHOP_CREDIT), nunca na compra PARCELADA de uma
// sequência inadimplente (ninguém parcela R$15 de streaming; confirmado
// 2026-09-20, listas de nomes continuam achatadas/`string[]` por compat com
// pickMerchant() e os testes que checam `.includes(nome)`).
const MASS_MERCHANTS_NACIONAL = ['iFood', 'Amazon BR', 'Posto Shell', 'Farmacia Pague Menos', 'Uber', 'Magazine Luiza', 'Zara', 'Mercado Livre', 'Atacadao', 'Acougue'];
const MASS_MERCHANTS_INTERNACIONAL = ['Shopee', 'Amazon.com', 'Temu', 'AliExpress', 'Shein'];
const MASS_MERCHANTS_ASSINATURA = ['Netflix', 'Spotify', 'Crunchyroll'];
const MASS_MERCHANTS = MASS_MERCHANTS_NACIONAL; // compat com código que ainda usa o nome antigo
const IOF_INTERNACIONAL_RATE = 0.0638;
const MASS_INTERNACIONAL_PROB = 0.3;
const round2 = (n) => Math.round(n * 100) / 100;

// Faixa de preço realista por merchant — pedido 2026-09-20 pra parar de repetir
// sempre o mesmo valor entre massas diferentes. min===max é assinatura (preço de
// tabela fixo, não varia). Netflix: valor de referência (plano Padrão, sem
// anúncios) — NÃO confirmado por busca ao vivo nesta sessão (indisponível);
// ajustar se o valor real divergir. Merchants sem entrada aqui caem no fallback
// genérico já existente nos loops de compra à vista.
const MERCHANT_PRICE_RANGES = {
    Netflix: [44.90, 44.90],
    Spotify: [40.39, 40.39],
    Crunchyroll: [15.00, 15.00],
    Atacadao: [400, 1700],
    Acougue: [100, 500],
    Temu: [100, 1400],
    'Mercado Livre': [50, 7000],
};

function sortearValorMerchant(nome, fallbackMin, fallbackMax) {
    const faixa = MERCHANT_PRICE_RANGES[nome];
    const [min, max] = faixa || [fallbackMin, fallbackMax];
    return round2(min + Math.random() * (max - min));
}

function calcIofInternacional(amount) {
    return round2((Number(amount) || 0) * IOF_INTERNACIONAL_RATE);
}

// Sorteia um merchant PARA COMPRA PARCELADA (sequência inadimplente) — nunca uma
// assinatura, só merchant de ticket alto o bastante pra fazer sentido parcelar.
// ~30% das compras são internacionais.
function pickMerchant() {
    const internacional = Math.random() < MASS_INTERNACIONAL_PROB;
    const lista = internacional ? MASS_MERCHANTS_INTERNACIONAL : MASS_MERCHANTS_NACIONAL;
    return { nome: lista[Math.floor(Math.random() * lista.length)], internacional };
}

// Sorteia um merchant PARA COMPRA À VISTA (SHOP_CREDIT) — inclui assinaturas.
// Devolve nome + valor já sorteado dentro da faixa realista do merchant.
function pickMerchantAvistaComValor(fallbackMin, fallbackMax) {
    const todos = [...MASS_MERCHANTS_ASSINATURA, ...MASS_MERCHANTS_NACIONAL];
    const nome = todos[Math.floor(Math.random() * todos.length)];
    return { nome, valor: sortearValorMerchant(nome, fallbackMin, fallbackMax) };
}

module.exports = {
    MASS_MERCHANTS_NACIONAL, MASS_MERCHANTS_INTERNACIONAL, MASS_MERCHANTS_ASSINATURA, MASS_MERCHANTS,
    calcIofInternacional, pickMerchant, pickMerchantAvistaComValor,
};
