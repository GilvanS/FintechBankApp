const eventBus = require('../../services/eventBus');
/**
 * shop.routes.js — Registro das rotas do Shop e Vouchers.
 *
 * [Fase D] Extraído do index.cjs. Factory com Dependency Injection que
 * centraliza as rotas da loja e troca de pontos (vouchers), mantendo a ordem e
 * os middlewares originais.
 */
module.exports = function registerShopRoutes({
    apiRouter,
    asyncHandler,
    bearerAuth,
    dbService,
    repoContext,
    shopRepo,
    vouchersRepo,
    usersRepo,
    telegramService,
    generateAndSendPurchaseReceipt,
    round2,
    buildJurosPayload,
    buildPurchaseTelegramMessage,
    toLocalSqlTimestamp,
}) {
    // --- Loja ---
    apiRouter.get('/shop/products', asyncHandler(async (req, res) => {
        const items = await shopRepo.listProducts();
        res.json(items);
    }));

    apiRouter.post('/shop/checkout', bearerAuth(), asyncHandler(async (req, res) => {
        console.log('🛒 [SHOP CHECKOUT] Iniciando checkout...');
        console.log('🛒 [SHOP CHECKOUT] Body recebido:', JSON.stringify(req.body));
        console.log('🛒 [SHOP CHECKOUT] User CPF:', req.user?.cpf);

        const { items, paymentMethod, cashbackUsed = 0, installments = 1, pin, interestRate } = req.body || {};

        if (!Array.isArray(items) || !items.length || !paymentMethod || !pin || String(pin).trim().length !== 4) {
            return res.status(400).json({ success: false, message: 'Payload invalido.' });
        }

        if (['card_debit', 'credit', 'ACCOUNT_DEBIT', 'debit'].includes(paymentMethod)) {
            const [card] = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('cards')} WHERE user_cpf = '${req.user.cpf}' AND card_type = 'physical'`);
            if (!card) {
                return res.status(403).json({ success: false, message: 'Cartão físico não encontrado.' });
            }
            if (!card.is_activated) {
                return res.status(403).json({ success: false, message: 'Cartão físico não está ativado.' });
            }
            if (card.is_blocked) {
                return res.status(403).json({ success: false, message: 'Cartão físico está bloqueado.' });
            }
            if (card.pin !== String(pin).trim()) {
                return res.status(401).json({ success: false, message: 'PIN incorreto.' });
            }
        }

        const catalog = await shopRepo.listProducts();
        console.log('📦 [SHOP CHECKOUT] Catálogo carregado:', catalog.length, 'produtos');
        console.log('📦 [SHOP CHECKOUT] IDs disponíveis:', catalog.map(p => p.id));

        const prices = new Map(catalog.map(p => [p.id, p.price]));
        const productById = new Map(catalog.map(p => [p.id, p]));

        let total = 0;
        for (const it of items) {
            console.log('🔍 [SHOP CHECKOUT] Validando item:', {
                productId: it.productId,
                productIdType: typeof it.productId,
                quantity: it.quantity,
                quantityType: typeof it.quantity,
                existsInCatalog: prices.has(it.productId),
                isInteger: Number.isInteger(it.quantity),
                quantityValid: it.quantity >= 1
            });

            if (!prices.has(it.productId)) {
                console.log('❌ [SHOP CHECKOUT] Produto não encontrado no catálogo:', it.productId);
                console.log('❌ [SHOP CHECKOUT] IDs disponíveis:', Array.from(prices.keys()));
                return res.status(400).json({
                    success: false,
                    message: `Item invalido: produto "${it.productId}" não encontrado no catálogo.`
                });
            }

            // Converter quantity para número se necessário
            const quantity = typeof it.quantity === 'string' ? parseInt(it.quantity, 10) : Number(it.quantity);

            if (!Number.isInteger(quantity) || quantity < 1 || isNaN(quantity)) {
                console.log('❌ [SHOP CHECKOUT] Quantidade inválida:', {
                    original: it.quantity,
                    converted: quantity,
                    type: typeof it.quantity
                });
                return res.status(400).json({
                    success: false,
                    message: `Item invalido: quantidade "${it.quantity}" inválida. Deve ser um número inteiro maior que zero.`
                });
            }

            // Atualizar o item com a quantidade convertida
            it.quantity = quantity;
            total += prices.get(it.productId) * quantity;
        }

        console.log('✅ [SHOP CHECKOUT] Todos os itens validados. Total:', total);

        // Taxa de pontos por metodo: debit=1%, credit=2%
        const pointsRate = paymentMethod === 'credit' ? 0.02 : 0.01;
        const points = Math.floor(total * pointsRate);

        // Cashback simples permitido apenas em debito
        const cashback = paymentMethod === 'debit' ? Math.min(Math.max(cashbackUsed, 0), total * 0.05) : 0; // max 5%
        const netDebit = total - cashback;

        // Variável para armazenar transactionId (usado no crédito)
        let creditTransactionId = undefined;

        if (paymentMethod === 'debit') {
            const { esc } = require('../../repositories/context');
            const user = await usersRepo.findByCpf(req.user.cpf);
            const balance = parseFloat(user.balance || 0);
            if (balance < netDebit) return res.status(400).json({ success: false, message: 'Saldo insuficiente' });
            await usersRepo.updateBalance(req.user.cpf, (balance - netDebit).toFixed(2));

            // Criar descrição amigável com nome do produto (similar ao crédito)
            let productDesc;
            if (Array.isArray(items) && items.length === 1) {
                const p0 = productById.get(items[0].productId);
                productDesc = (p0 && p0.name) ? p0.name : 'Compra shop (debito)';
            } else if (Array.isArray(items) && items.length > 1) {
                const p0 = productById.get(items[0].productId);
                const baseName = (p0 && p0.name) ? p0.name : 'Item';
                productDesc = `${baseName} + ${(items.length - 1)} itens`;
            } else {
                productDesc = 'Compra shop (debito)';
            }

            const txId = dbService.generateUUID();
            const now = new Date().toISOString();
            // Valor NEGATIVO pois é um débito (saída de dinheiro)
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
                VALUES (${esc(txId)}, ${esc(req.user.cpf)}, ${esc('SHOP_DEBIT')}, ${-netDebit.toFixed(2)}, ${esc(productDesc)}, ${esc(now)})
            `);
            telegramService.send('purchase', { cpf: req.user.cpf, text: buildPurchaseTelegramMessage({
                tipo: 'DEBIT',
                estabelecimento: productDesc,
                original: netDebit,
                totalParcelado: netDebit,
                installments: 1,
                interestRate: 0,
                dataCompra: now,
            }) }).catch(() => {});
            // Comprovante de compra (art. 52 CDC) no tópico da massa — fire-and-forget
            generateAndSendPurchaseReceipt({
                cpf: req.user.cpf,
                data: {
                    estabelecimento: productDesc,
                    formaPagamento: 'Cartão de débito',
                    tipoPagamento: 'À vista (débito)',
                    totalParcelas: 1,
                    originalAmount: round2(netDebit),
                    jurosTotal: 0,
                    interestRate: 0,
                    totalParcelado: round2(netDebit),
                    valorParcela: round2(netDebit),
                    taxaEfetivaMensal: 0,
                    taxaEfetivaAnual: 0,
                    dataCompra: now,
                    transactionId: txId,
                    autenticacao: `FB-${Date.now().toString(36).toUpperCase()}`,
                },
            }).catch(() => {});

            if (cashback > 0) {
                const cashbackTxId = dbService.generateUUID();
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
                    VALUES (${esc(cashbackTxId)}, ${esc(req.user.cpf)}, ${esc('CASHBACK_CREDIT')}, ${cashback.toFixed(2)}, ${esc('Cashback shop')}, ${esc(now)})
                `);
                telegramService.send('purchase', { cpf: req.user.cpf, text: `💰 Cashback: R$ ${cashback.toFixed(2)}` }).catch(() => {});
            }

            // Persistir itens comprados e pontos por item (para débito)
            for (const it of items) {
                const p = productById.get(it.productId);
                const itemTotal = Number(p.price) * it.quantity;
                const itemPoints = Math.floor(itemTotal * pointsRate);
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('purchased_items')}
                    (id, cpf, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments)
                    VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', '${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description||'').replace(/'/g,"''")}', ${Number(p.price).toFixed(2)}, '${p.image_url || p.imageUrl || ''}', ${it.quantity}, ${itemPoints}, current_timestamp(), '${paymentMethod}', ${Number(cashback).toFixed(2)}, NULL)
                `);
            }

            // Registrar pontos ganhos
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
                VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', 'POINTS_EARNED', ${points}, 'Pontos ganhos no shop', current_timestamp())
            `);

            // Preparar detalhes dos produtos comprados
            const purchasedProducts = items.map(it => {
                const p = productById.get(it.productId);
                return {
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price),
                    quantity: it.quantity,
                    subtotal: parseFloat(p.price) * it.quantity
                };
            });

            // Retornar sucesso com a transação criada e detalhes dos produtos
            res.status(201).json({
                success: true,
                message: 'Compra realizada com sucesso',
                purchase: {
                    products: purchasedProducts,
                    productsDescription: productDesc,
                    totalAmount: netDebit,
                    paymentMethod: 'debit',
                    cashbackUsed: cashback,
                    pointsEarned: points,
                    transaction: {
                        id: txId,
                        type: 'SHOP_DEBIT',
                        amount: -netDebit,
                        description: productDesc,
                        date: now
                    }
                }
            });

            eventBus.publish('purchase.completed', {
                cpf: req.user.cpf,
                totalAmount: netDebit,
                paymentMethod: 'debit',
                productsDescription: productDesc,
                transactionId: txId,
            }).catch(() => {});
            return;
        } else if (paymentMethod === 'ACCOUNT_DEBIT') {
            const billId = dbService.generateUUID();
            const { toLocalSqlTimestamp } = require('../../utils/timezone');
            const nowIso = toLocalSqlTimestamp();
            const now = new Date();
            const freq = req.body.frequency || 'MONTHLY';
            const { esc } = require('../../repositories/context');

            // Criar descrição amigável com nome do produto
            let productDesc;
            if (Array.isArray(items) && items.length === 1) {
                const p0 = productById.get(items[0].productId);
                productDesc = (p0 && p0.name) ? p0.name : 'Assinatura shop';
            } else if (Array.isArray(items) && items.length > 1) {
                const p0 = productById.get(items[0].productId);
                const baseName = (p0 && p0.name) ? p0.name : 'Item';
                productDesc = `${baseName} + ${(items.length - 1)} itens`;
            } else {
                productDesc = 'Assinatura shop';
            }
            const safeProductDesc = productDesc.replace(/'/g, "''");

            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('recurring_bills')}
                (id, cpf, name, amount, due_day, category, status, frequency, payment_method, created_at, updated_at)
                VALUES (${esc(billId)}, ${esc(req.user.cpf)}, ${esc(safeProductDesc)}, ${total.toFixed(2)}, ${now.getDate()}, 'outros', 'active', ${esc(freq)}, 'ACCOUNT_DEBIT', ${esc(nowIso)}, ${esc(nowIso)})
            `);

            // Transparência de encargos (CDC art. 52 · Res. BCB 96/2021 e 365/2023): quando a assinatura
            // tiver encargos, a mensagem expõe juros R$ e total com/sem financiamento (mesmo padrão da loja).
            telegramService.send('purchase', { cpf: req.user.cpf, text: buildPurchaseTelegramMessage({
                tipo: 'SUBSCRIPTION',
                estabelecimento: productDesc,
                original: total,
                totalParcelado: total,
                installments: 1,
                interestRate: 0,
                dataCompra: nowIso,
            }) }).catch(() => {});

            generateAndSendPurchaseReceipt({
                cpf: req.user.cpf,
                data: {
                    estabelecimento: productDesc,
                    formaPagamento: 'Débito automático em conta',
                    tipoPagamento: 'Assinatura (débito automático)',
                    totalParcelas: 1,
                    originalAmount: round2(total),
                    jurosTotal: 0,
                    interestRate: 0,
                    totalParcelado: round2(total),
                    valorParcela: round2(total),
                    taxaEfetivaMensal: 0,
                    taxaEfetivaAnual: 0,
                    dataCompra: nowIso,
                    transactionId: billId,
                    autenticacao: `FB-${Date.now().toString(36).toUpperCase()}`,
                },
            }).catch(() => {});

            creditTransactionId = billId;
        } else if (paymentMethod === 'credit') {
            if (!Number.isInteger(installments) || installments < 1 || installments > 24) {
                return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
            }
            const qty = installments;
            // Validar juros quando >= 13 parcelas (1% a 7%)
            let rate = 0;
            if (qty >= 13) {
                if (typeof interestRate !== 'number' || interestRate < 0.01 || interestRate > 0.07) {
                    return res.status(400).json({ success: false, message: 'interestRate obrigatorio entre 0.01 e 0.07 para >= 13 parcelas.' });
                }
                rate = interestRate;
            }

            const user = await usersRepo.findByCpf(req.user.cpf);
            if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
            if (user.credit_card_is_blocked) return res.status(403).json({ success: false, message: 'Cartao bloqueado.' });

            // Validar que o limite do cartão existe e está configurado
            const totalLimit = parseFloat(user.credit_card_total_limit || 0);

            // Se o limite não estiver configurado, retornar erro específico
            if (!Number.isFinite(totalLimit) || totalLimit <= 0) {
                return res.status(400).json({ success: false, message: 'Limite do cartao de credito nao configurado. Entre em contato com o suporte.' });
            }

            // Buscar limite disponível - se for NULL ou não definido, usar o limite total
            let availableLimit = parseFloat(user.credit_card_available_limit);

            // Se o limite disponível não estiver definido, for inválido, ou for maior que o limite total, corrigir
            // IMPORTANTE: Se o limite disponível for maior que o total, algo está errado e precisa ser corrigido
            if (!Number.isFinite(availableLimit) || availableLimit < 0 || availableLimit > totalLimit) {
                // Se o limite disponível não estiver definido ou for inválido, inicializar com o limite total
                availableLimit = totalLimit;
                const { esc } = require('../../repositories/context');
                await dbService.executeQuery(`
                    UPDATE ${dbService.fq('users')}
                    SET credit_card_available_limit = ${totalLimit.toFixed(2)}
                    WHERE cpf = ${esc(req.user.cpf)}
                `);
                // Atualizar o objeto user para refletir a correção
                user.credit_card_available_limit = totalLimit;
            }

            // Garantir que o limite disponível não seja maior que o limite total (correção de segurança)
            if (availableLimit > totalLimit) {
                availableLimit = totalLimit;
                const { esc } = require('../../repositories/context');
                await dbService.executeQuery(`
                    UPDATE ${dbService.fq('users')}
                    SET credit_card_available_limit = ${totalLimit.toFixed(2)}
                    WHERE cpf = ${esc(req.user.cpf)}
                `);
            }

            const finalAvailableLimit = availableLimit;

            // Calcular valor a ser consumido do limite
            const creditAmount = qty === 1 ? (total * 0.90) : total; // 1x: 10% desconto, sem parcelas
            // Para parcelas: 2-12 sem juros = valor total; 13-24 com juros = valor total + juros
            const totalParcelado = qty >= 2 ? (qty >= 13 ? total * (1 + rate) : total) : 0;
            // Consumo do limite:
            // - Para 1x: desconto de 10% (total * 0.90)
            // - Para 2-12 parcelas SEM JUROS: consome apenas o valor total da compra
            // - Para 13-24 parcelas COM JUROS: consome o valor total + juros
            const consumoLimite = qty === 1 ? creditAmount : totalParcelado;

            // Log para debug (pode remover depois)
            console.log(`[CHECKOUT CREDIT] CPF: ${req.user.cpf}, Total: R$ ${total.toFixed(2)}, Parcelas: ${qty}, Taxa: ${rate}, TotalParcelado: R$ ${totalParcelado.toFixed(2)}, ConsumoLimite: R$ ${consumoLimite.toFixed(2)}, LimiteDisponivel: R$ ${finalAvailableLimit.toFixed(2)}`);

            // Validar limite disponível - IMPORTANTE: usar limite do cartão, NÃO o saldo da conta
            if (!Number.isFinite(finalAvailableLimit) || finalAvailableLimit < consumoLimite) {
                eventBus.publish('purchase.declined', { cpf: req.user.cpf, requiredAmount: consumoLimite, availableLimit: finalAvailableLimit, reason: 'limite_insuficiente', type: 'credit' }).catch(() => {});
                return res.status(400).json({
                    success: false,
                    message: `Limite de credito insuficiente. Disponivel: R$ ${finalAvailableLimit.toFixed(2)}, Necessario: R$ ${consumoLimite.toFixed(2)}`
                });
            }

            // Debitar limite disponível do CARTÃO DE CRÉDITO (não do saldo da conta)
            // IMPORTANTE: NUNCA debitar do balance (saldo da conta) para compras no crédito
            const newAvailableLimit = finalAvailableLimit - consumoLimite;
            const { esc } = require('../../repositories/context');
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET credit_card_available_limit = ${newAvailableLimit.toFixed(2)}
                WHERE cpf = ${esc(req.user.cpf)}
            `);

            const { toLocalSqlTimestamp } = require('../../utils/timezone');
            const nowIso = toLocalSqlTimestamp();
            // Registrar compra visível na fatura aberta
            // Descrição amigável da compra: nome do primeiro produto ou "<Primeiro produto> + N itens"
            let productDesc;
            if (Array.isArray(items) && items.length === 1) {
                const p0 = productById.get(items[0].productId);
                productDesc = (p0 && p0.name) ? p0.name : 'Compra shop';
            } else if (Array.isArray(items) && items.length > 1) {
                const p0 = productById.get(items[0].productId);
                const baseName = (p0 && p0.name) ? p0.name : 'Item';
                productDesc = `${baseName} + ${(items.length - 1)} itens`;
            } else {
                productDesc = 'Compra shop';
            }
            const safeProductDesc = productDesc.replace(/'/g, "''");

            const txId = dbService.generateUUID();
            creditTransactionId = txId; // Armazenar para uso na resposta
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES ('${txId}', '${req.user.cpf}', 'SHOP_CREDIT', -${creditAmount.toFixed(2)}, '${safeProductDesc}', NULL, NULL, NULL, '${nowIso}')
            `);
            // Transparência de encargos (CDC art. 52 · Res. BCB 96/2021 e 365/2023): quando a compra
            // tiver juros, a mensagem expõe juros R$, taxa efetiva e total com/sem financiamento.
            // Vencimentos das parcelas (mesma regra do bloco abaixo: corte = vencimento - 7 dias;
            // parcela i = corte + (i-1) mês) — p/ listar PARC 1..N na tabela da mensagem.
            const parcelasVenc = [];
            if (qty >= 2) {
                const _due = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();
                const _firstDue = new Date(_due);
                _firstDue.setDate(_firstDue.getDate() - 7);
                _firstDue.setUTCHours(23, 59, 59, 999);
                const _parcela = totalParcelado / qty;
                for (let i = 0; i < qty; i++) {
                    const d = new Date(_firstDue);
                    d.setUTCMonth(_firstDue.getUTCMonth() + i);
                    parcelasVenc.push({ vencimento: d, valor: _parcela });
                }
            }
            telegramService.send('purchase', { cpf: req.user.cpf, text: buildPurchaseTelegramMessage({
                tipo: 'CREDIT',
                estabelecimento: productDesc,
                original: creditAmount,
                totalParcelado: qty >= 2 ? totalParcelado : creditAmount,
                installments: qty,
                interestRate: rate,
                dataCompra: nowIso,
                parcelas: parcelasVenc,
            }) }).catch(() => {});

            // Gerar somente a 1a parcela na fatura atual e criar plano agregado para as futuras
            if (qty >= 2) {
                const now = new Date();

                // Buscar vencimento da fatura aberta atual do usuário
                const userRows = await dbService.executeQuery(
                    `SELECT credit_card_invoice_due_date FROM ${dbService.fq('users')} WHERE cpf = '${req.user.cpf}'`
                );
                const user = userRows[0] || {};
                const userDueDate = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();

                // O corte da fatura (data da primeira parcela) é 7 dias antes do vencimento
                const firstDue = new Date(userDueDate);
                firstDue.setDate(firstDue.getDate() - 7);
                firstDue.setUTCHours(23, 59, 59, 999);

                const parcela = totalParcelado / qty;

                // 1a parcela (aparecer na fatura vigente) com nome do produto
                const firstInstId = dbService.generateUUID();
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('transactions')}
                    (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                    VALUES ('${firstInstId}', '${req.user.cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${safeProductDesc} (1/${qty})', NULL, NULL, NULL, '${toLocalSqlTimestamp(firstDue)}')
                `);

                // Plano agregado (restante das parcelas)
                const remainingBalance = (totalParcelado - parcela).toFixed(2);
                const nextDueDate = new Date(firstDue);
                nextDueDate.setUTCMonth(firstDue.getUTCMonth() + 1);

                const planId = dbService.generateUUID();
                const { esc } = require('../../repositories/context');
                const planNow = toLocalSqlTimestamp();
                // original_amount = valor original da compra (sem juros), total_amount = valor total parcelado (com juros se houver)
                // total_with_interest = mesmo que total_amount para compras com juros, ou total para compras sem juros
                const originalAmount = total; // Valor original sem juros
                const totalWithInterest = totalParcelado; // Valor total com juros (se houver) - igual ao total_amount

                // Verificar se as colunas existem antes de inserir
                try {
                    const columnCheck = await dbService.executeQuery(`
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = 'fintech'
                        AND table_name = 'installment_plans'
                        AND column_name IN ('original_amount', 'total_with_interest')
                    `);
                    const existingColumns = columnCheck.map(c => c.column_name);
                    console.log('🔍 [SHOP CHECKOUT] Colunas encontradas em installment_plans:', existingColumns);

                    if (!existingColumns.includes('original_amount') || !existingColumns.includes('total_with_interest')) {
                        console.log('⚠️ [SHOP CHECKOUT] Colunas faltando. Tentando adicionar...');
                        // Tentar adicionar as colunas se não existirem
                        if (!existingColumns.includes('original_amount')) {
                            await dbService.executeQuery(`
                                ALTER TABLE ${dbService.fq('installment_plans')}
                                ADD COLUMN original_amount DECIMAL(15,2) DEFAULT 0.00
                            `);
                            console.log('✅ [SHOP CHECKOUT] Coluna original_amount adicionada.');
                        }
                        if (!existingColumns.includes('total_with_interest')) {
                            await dbService.executeQuery(`
                                ALTER TABLE ${dbService.fq('installment_plans')}
                                ADD COLUMN total_with_interest DECIMAL(15,2) DEFAULT 0.00
                            `);
                            console.log('✅ [SHOP CHECKOUT] Coluna total_with_interest adicionada.');
                        }
                    }
                } catch (checkError) {
                    console.warn('⚠️ [SHOP CHECKOUT] Erro ao verificar colunas (continuando mesmo assim):', checkError.message);
                }

                // Inserir plano de parcelamento - sempre incluir total_with_interest (mesmo valor que total_amount)
                console.log('💾 [SHOP CHECKOUT] Inserindo plano de parcelamento...');
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('installment_plans')}
                    (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
                    VALUES (${esc(planId)}, ${esc(req.user.cpf)}, ${esc(txId)}, ${esc('Compra shop (credito)')}, ${originalAmount.toFixed(2)}, ${totalParcelado.toFixed(2)}, ${totalWithInterest.toFixed(2)}, ${qty}, ${parcela.toFixed(2)}, ${typeof rate === 'number' ? rate.toFixed(4) : '0.0000'}, ${remainingBalance}, ${qty - 1}, ${esc(toLocalSqlTimestamp(nextDueDate))}, ${esc('ACTIVE')}, ${esc(planNow)}, ${esc(planNow)})
                `);
                console.log('✅ [SHOP CHECKOUT] Plano de parcelamento inserido com sucesso.');
            }

            // Comprovante de compra (art. 52 CDC) no tópico da massa — fire-and-forget
            {
                const _jp = buildJurosPayload({ original: total, totalWithInterest: qty >= 2 ? totalParcelado : creditAmount, installments: qty, interestRate: rate });
                generateAndSendPurchaseReceipt({
                    cpf: req.user.cpf,
                    data: {
                        estabelecimento: productDesc,
                        formaPagamento: 'Cartão de crédito',
                        tipoPagamento: qty === 1 ? 'À vista' : (rate > 0 ? 'Parcelado com juros' : 'Parcelado sem juros'),
                        totalParcelas: qty,
                        parcelaAtual: 1,
                        dataCompra: nowIso,
                        transactionId: txId,
                        autenticacao: `FB-${Date.now().toString(36).toUpperCase()}`,
                        ..._jp,
                    },
                }).catch(() => {});
            }
        } else {
            return res.status(400).json({ success: false, message: 'Metodo de pagamento invalido.' });
        }

        // Persistir itens comprados e pontos por item
        for (const it of items) {
            const p = productById.get(it.productId);
            const itemTotal = Number(p.price) * it.quantity;
            const itemPoints = Math.floor(itemTotal * pointsRate);
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('purchased_items')}
                (id, cpf, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments)
                VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', '${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description||'').replace(/'/g,"''")}', ${Number(p.price).toFixed(2)}, '${p.image_url || p.imageUrl || ''}', ${it.quantity}, ${itemPoints}, current_timestamp(), '${paymentMethod}', ${paymentMethod === 'debit' ? Number(cashback).toFixed(2) : 0}, ${paymentMethod === 'credit' ? installments : 'NULL'})
            `);
        }

        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', 'POINTS_EARNED', ${points}, 'Pontos ganhos no shop', current_timestamp())
        `);

        // Preparar detalhes dos produtos comprados
        const purchasedProducts = items.map(it => {
            const p = productById.get(it.productId);
            return {
                id: p.id,
                name: p.name,
                price: parseFloat(p.price),
                quantity: it.quantity,
                subtotal: parseFloat(p.price) * it.quantity
            };
        });

        // Criar descrição resumida dos produtos
        let productsDescription;
        if (purchasedProducts.length === 1) {
            productsDescription = purchasedProducts[0].name;
        } else {
            productsDescription = `${purchasedProducts[0].name} + ${purchasedProducts.length - 1} outro(s) item(ns)`;
        }

        // Calcular valores finais - para crédito, usar variáveis do escopo correto
        let finalAmountLabel;
        let purchaseJuros = null;
        if (paymentMethod === 'credit') {
            // Para crédito, o valor final depende se é parcelado ou não
            const qty = installments;
            const rate = qty >= 13 ? (interestRate || 0) : 0;
            const totalParcelado = qty >= 2 ? (qty >= 13 ? total * (1 + rate) : total) : 0;
            const creditAmount = qty === 1 ? (total * 0.90) : total;
            finalAmountLabel = qty === 1 ? creditAmount : totalParcelado;
            // art. 52 CDC — expor encargos de juros no payload da compra
            // originalAmount = valor original; jurosTotal = juros em R$; taxa efetiva
            // mensal/anual derivada da taxa total one-shot (calcEffectiveRates).
            purchaseJuros = buildJurosPayload({
                original: total,
                totalWithInterest: qty >= 2 ? totalParcelado : creditAmount,
                installments: qty,
                interestRate: rate,
            });
        } else {
            finalAmountLabel = netDebit;
        }

        res.status(201).json({
            success: true,
            message: 'Compra realizada com sucesso',
            purchase: {
                products: purchasedProducts,
                productsDescription,
                totalAmount: finalAmountLabel,
                paymentMethod,
                installments: paymentMethod === 'credit' ? installments : 1,
                pointsEarned: points,
                transactionId: creditTransactionId,
                ...(purchaseJuros || {})
            }
        });

        // Publicado depois da persistência: o evento não pode anunciar uma compra
        // que ainda poderia falhar. Falha no barramento não afeta o checkout.
        eventBus.publish('purchase.completed', {
            cpf: req.user.cpf,
            totalAmount: finalAmountLabel,
            paymentMethod,
            installments: paymentMethod === 'credit' ? installments : 1,
            productsDescription,
            transactionId: creditTransactionId,
        }).catch(() => {});
    }));

    // --- Vouchers ---
    apiRouter.get('/vouchers/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
        const { cpf } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const vouchers = await vouchersRepo.listByCpf(cpf);
        res.json({ success: true, vouchers });
    }));
};
