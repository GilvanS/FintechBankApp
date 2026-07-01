// Leitura automatica de WEB/data/mockData.ts com fallback seguro
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENABLE_CARD_TX_MAPPING = process.env.SEED_MAP_CARD_TX === '1';

function mapCardTransactions(u) {
  if (!ENABLE_CARD_TX_MAPPING || !u || !u.creditCard) return [];
  const cardTx = []
    .concat(Array.isArray(u.creditCard.transactions) ? u.creditCard.transactions : [])
    .concat(Array.isArray(u.creditCard.closedTransactions) ? u.creditCard.closedTransactions : []);
  return cardTx.map(ct => ({
    id: `cc-${ct.id || Math.random().toString(36).slice(2)}`,
    type: 'PAYMENT',
    amount: -Math.abs(Number(ct.amount) || 0),
    date: ct.date,
    description: ct.merchant ? `${ct.merchant}${ct.installments ? ` (${ct.installments})` : ''}` : 'Compra cartao',
    from: null,
    to: null,
    toKey: null
  }));
}

// Fallback definido antes do uso
const fallback = {
  users: [
    {
      cpf: '22222222222',
      fullName: 'Beatriz Oliveira',
      email: 'beatriz@example.com',
      password: '123',
      balance: 2580.50,
      role: 'customer',
      pixDailyLimit: 2000,
      pixKeys: [{ type: 'EMAIL', key: 'beatriz@example.com' }],
      pixContacts: [{ name: 'Carlos Souza', key: 'carlos@example.com' }],
      transactions: [
        { id: 'tx-1', type: 'PIX_RECEIVED', amount: 50.00, date: new Date().toISOString(), description: 'Presente', from: '33333333333', to: null, toKey: null },
        { id: 'tx-2', type: 'PAYMENT', amount: -35.90, date: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'Cafeteria', from: null, to: null, toKey: null }
      ],
      notifications: [
        { title: 'Bem vindo', message: 'Sua conta foi criada com sucesso', actionUrl: '/dashboard' }
      ]
    }
  ],
  products: [
    { id: 'prod-pet', name: 'Plano Pet Premium', description: 'Cobertura completa para o seu pet. Consultas, exames, vacinas e emergencias 24h em toda a rede credenciada.', price: 99.90, imageUrl: 'https://images.pexels.com/photos/245035/pexels-photo-245035.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Planos', cashback: '20% de Cashback' },
    { id: 'prod-1',  name: 'Smartphone Fintech X', description: 'O mais novo smartphone com integracao total ao nosso ecossistema. Camera de 108MP, 256GB de armazenamento e tela Super AMOLED.', price: 3999.90, imageUrl: 'https://images.pexels.com/photos/404280/pexels-photo-404280.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Eletrônicos', cashback: '10% de Cashback' },
    { id: 'prod-2',  name: 'Fone de Ouvido Bass+', description: 'Cancelamento de ruido ativo, 30 horas de bateria e som de alta fidelidade para voce curtir suas musicas e podcasts.', price: 799.00, imageUrl: 'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Áudio', cashback: '5% de Cashback' },
    { id: 'prod-3',  name: 'Smartwatch Connect', description: 'Monitore sua saude, receba notificacoes e pague por aproximacao com seu novo smartwatch. Bateria para 7 dias.', price: 1499.90, imageUrl: 'https://images.pexels.com/photos/110471/pexels-photo-110471.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Acessórios', cashback: '7% de Cashback' },
    { id: 'prod-4',  name: 'Carregador Portatil 20000mAh', description: 'Nunca mais fique sem bateria. Carregue ate 3 dispositivos ao mesmo tempo com alta velocidade.', price: 250.00, imageUrl: 'https://images.pexels.com/photos/133505/pexels-photo-133505.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Acessórios', cashback: '5% de Cashback' },
    { id: 'prod-5',  name: 'Audeze Pro Headphones', description: 'Fones de ouvido com qualidade de studio para audiofilos. Clareza e graves incomparaveis.', price: 499.00, imageUrl: 'https://images.pexels.com/photos/1649771/pexels-photo-1649771.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Áudio', cashback: '12% de Cashback' },
    { id: 'prod-6',  name: 'Apex Smartwatch Gen 2', description: 'Monitore sua saude e conecte-se com estilo. GPS integrado e bateria de longa duracao.', price: 279.00, imageUrl: 'https://images.pexels.com/photos/277406/pexels-photo-277406.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Acessórios', cashback: '7% de Cashback' },
    { id: 'prod-7',  name: 'Momentum Pro Camera', description: 'Capture momentos com qualidade profissional. Sensor full-frame de 42MP e video em 4K.', price: 1299.00, imageUrl: 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Fotografia', cashback: '6% de Cashback' },
    { id: 'prod-8',  name: 'Barista Express Coffee Maker', description: 'Seu cafe expresso perfeito em casa. Moedor integrado e controle de temperatura preciso.', price: 189.00, imageUrl: 'https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Eletroportáteis', cashback: '5% de Cashback' },
    { id: 'prod-9',  name: 'Minimalist Desk Lamp', description: 'Design elegante e iluminacao ajustavel para seu espaco de trabalho. Baixo consumo de energia.', price: 75.00, imageUrl: 'https://images.pexels.com/photos/1112598/pexels-photo-1112598.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Iluminação', cashback: '4% de Cashback' },
    { id: 'prod-10', name: 'Jetset Carry-On Luggage', description: 'Viaje com estilo e praticidade. Leve, resistente e com compartimentos inteligentes.', price: 150.00, imageUrl: 'https://images.pexels.com/photos/5945559/pexels-photo-5945559.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Viagem', cashback: '5% de Cashback' },
    { id: 'prod-11', name: 'AeroView 4K Drone', description: 'Explore o mundo de cima com imagens incriveis. Compacto, seguro e facil de pilotar.', price: 799.00, imageUrl: 'https://images.pexels.com/photos/1034608/pexels-photo-1034608.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Drones', cashback: '10% de Cashback' },
    { id: 'prod-12', name: 'ErgoFlex Office Chair', description: 'Conforto e ergonomia para longas horas de trabalho. Multiplos ajustes para sua postura.', price: 350.00, imageUrl: 'https://images.pexels.com/photos/2762247/pexels-photo-2762247.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', category: 'Móveis', cashback: '5% de Cashback' },
    { id: 'prod_1',  name: 'Smartphone Fintech X', description: 'O smartphone mais inteligente para suas financas. Tela OLED de 120Hz, processador de ultima geracao e seguranca bancaria por hardware integrada.', price: 3999.90, imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=600', category: 'Eletrônicos', cashback: '8% de Cashback' },
    { id: 'prod_2',  name: 'Momentum Pro Camera', description: 'Capture todos os seus momentos inesqueciveis em resolucao 4K com o sensor ultra-sensivel e autofoco inteligente baseado em inteligencia artificial.', price: 1299.00, imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=600', category: 'Fotografia', cashback: '6% de Cashback' },
    { id: 'prod_3',  name: 'AeroView 4K Drone', description: 'Estabilidade perfeita e transmissao em tempo real. Voe alto e grave takes cinematicos incriveis com facilidade de controle automatic.', price: 799.00, imageUrl: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&q=80&w=600', category: 'Drones', cashback: '10% de Cashback' },
    { id: 'prod_4',  name: 'ErgoFlex Office Chair', description: 'Design ergonomico premiado para longas horas de produtividade ou jogos. Ajuste lombar dinamico e materiais respiraveis de alta qualidade.', price: 350.00, imageUrl: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=600', category: 'Móveis', cashback: '5% de Cashback' },
    { id: 'prod_5',  name: 'Audeze Pro Headphones', description: 'Audio de studio de alta fidelidade e cancelamento de ruido ativo inteligente. Experimente cada nota com perfeicao e imersao completa.', price: 499.00, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600', category: 'Áudio', cashback: '12% de Cashback' },
    { id: 'prod_6',  name: 'Minimalist Desk Lamp', description: 'Luminaria minimalista com ajuste de temperatura de cor inteligente e base de carregamento rapido sem fio integrada para seu smartphone.', price: 75.00, imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&q=80&w=600', category: 'Iluminação', cashback: '4% de Cashback' },
    { id: 'prod_7',  name: 'Fone de Ouvido Bass+', description: 'Graves profundos e bateria que dura a semana toda. Ideal para treinos intensos com protecao IPX7 contra agua e suor.', price: 199.00, imageUrl: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=600', category: 'Áudio', cashback: '10% de Cashback' },
    { id: 'prod_8',  name: 'Apex Smartwatch Gen 2', description: 'Monitore seus batimentos, sono e exercicios diarios. Notificacoes do celular diretamente no seu pulso em uma tela de alta definicao.', price: 279.00, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600', category: 'Acessórios', cashback: '7% de Cashback' },
    { id: 'prod_9',  name: 'Jetset Carry-On Luggage', description: 'Mala de bordo ultraleve e extremamente resistente. Rodinhas 360 graus ultra-silenciosas e compartimento inteligente de facil acesso.', price: 180.00, imageUrl: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&q=80&w=600', category: 'Viagem', cashback: '5% de Cashback' }
  ]
};

function parseFrontendMockData() {
  try {
    const tsPath = path.resolve(__dirname, '../../WEB/data/mockData.ts');
    if (!fs.existsSync(tsPath)) {
      return null;
    }
    const src = fs.readFileSync(tsPath, 'utf8');
    const stripped = src
      .replace(/\r?\n/g, '\n')
      .replace(/import[^\n]*\n/g, '')
      .replace(/export const MOCK_USERS:\s*[^=]+=/, 'var MOCK_USERS =')
      .replace(/export const MOCK_PRODUCTS:\s*[^=]+=/, 'var MOCK_PRODUCTS =')
      .replace(/export const MOCK_STORIES:\s*[^=]+=/, 'var MOCK_STORIES =');

    const sandbox = { Date, console };
    vm.createContext(sandbox);
    new vm.Script(stripped, { filename: 'mockData.ts' }).runInContext(sandbox);

    const users = (sandbox.MOCK_USERS || []).map(u => {
      const baseTx = (u.transactions || []).map(tx => ({
        id: tx.id,
        type: tx.type === 'PIX_RECEIVED' ? 'PIX_RECEIVED' : 'PAYMENT',
        amount: Number(tx.amount),
        date: tx.date,
        description: tx.description || null,
        from: tx.from || null,
        to: tx.to || null,
        toKey: tx.toKey || null
      }));
      const cardTx = mapCardTransactions(u);
      return {
        cpf: u.cpf,
        fullName: u.fullName,
        email: u.email,
        password: u.password,
        balance: u.balance,
        role: u.role === 'admin' ? 'admin' : 'customer',
        pixDailyLimit: u.pixDailyLimit,
        pixKeys: Array.isArray(u.pixKeys) ? u.pixKeys : [],
        pixContacts: Array.isArray(u.pixContacts) ? u.pixContacts : [],
        transactions: baseTx.concat(cardTx),
        notifications: [
          { title: 'Bem vindo', message: 'Conta criada', actionUrl: '/dashboard' }
        ]
      };
    });

    const products = Array.isArray(sandbox.MOCK_PRODUCTS) ? sandbox.MOCK_PRODUCTS : [];

    // Mapear stories se existirem
    const storiesRaw = Array.isArray(sandbox.MOCK_STORIES) ? sandbox.MOCK_STORIES : [];
    const stories = storiesRaw.map(s => ({
      id: s.id || `story-${Math.random().toString(36).slice(2)}`,
      cpf: s.cpf || s.ownerCpf || s.userCpf || users[0]?.cpf || '12345678901',
      imageUrl: s.imageUrl || s.mediaUrl || s.url || '',
      caption: s.caption || s.text || s.title || '',
      createdAt: s.createdAt || s.timestamp || s.date || new Date().toISOString()
    })).filter(st => st.imageUrl);

    return { users, products, stories };
  } catch (err) {
    return null;
  }
}

const autoData = parseFrontendMockData();
const users = autoData && Array.isArray(autoData.users) && autoData.users.length ? autoData.users : fallback.users;
const products = autoData && Array.isArray(autoData.products) && autoData.products.length ? autoData.products : fallback.products;
const stories = autoData && Array.isArray(autoData.stories) ? autoData.stories : [];

module.exports = { users, products, stories };