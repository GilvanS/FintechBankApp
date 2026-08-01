const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const DatabaseFactory = require('./services/database/DatabaseFactory');
const transactionReversal = require('./utils/transactionReversal');

const dbService = DatabaseFactory.createDatabaseService();

async function testCancel() {
    console.log("=== INICIANDO TESTE DE ESTORNO DE TRANSAÇÃO ===");
    const id = 'ee0af3e5-472c-4984-b0c4-09578635ad18';
    const cpf = '11111111111';

    try {
        await dbService.connect();
        
        console.log(`Buscando transação ID: ${id} | CPF: ${cpf}`);
        const [transaction] = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('transactions')} WHERE id = '${id}' AND cpf = '${cpf}'`
        );
        
        if (!transaction) {
            console.log("ERRO: Transação não encontrada.");
            process.exit(1);
        }
        console.log("Transação encontrada:", transaction);

        console.log("Verificando se já foi estornada...");
        const [alreadyRefunded] = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}' AND type = 'REFUND' AND description LIKE '%${id}%'`
        );
        
        if (alreadyRefunded) {
            console.log("ERRO: Transação JÁ FOI ESTORNADA anteriormente.");
            console.log("Transação de Estorno:", alreadyRefunded);
            process.exit(1);
        }

        console.log("Buscando limite de crédito ATUAL do usuário...");
        const [userBefore] = await dbService.executeQuery(
            `SELECT credit_card_available_limit, balance FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`
        );
        console.log("Limite Antes do Estorno:", userBefore.credit_card_available_limit);

        console.log("Buscando faturas fechadas para definir o tipo de estorno...");
        const closedInvoices = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('invoices')} WHERE cpf = '${cpf}' AND status = 'FECHADA'`
        );

        console.log("Calculando plano de estorno...");
        const plan = transactionReversal.computeReversalPlan({ transaction, closedInvoices });
        if (!plan.ok) {
            console.log("ERRO no plano de estorno:", plan.reason);
            process.exit(1);
        }
        console.log("Plano de estorno calculado:", plan);

        const amount = plan.amount;
        const now = new Date().toISOString();
        const reversalId = dbService.generateUUID();
        const finalDescription = `${plan.description} (Original: ${id})`;

        console.log(`Aplicando estorno de R$ ${amount}...`);
        
        if (plan.kind === 'debit_refund') {
            await dbService.executeQuery(
                `UPDATE ${dbService.fq('users')} SET balance = balance + ${amount} WHERE cpf = '${cpf}'`
            );
        } else {
            await dbService.executeQuery(
                `UPDATE ${dbService.fq('users')} SET credit_card_available_limit = credit_card_available_limit + ${amount} WHERE cpf = '${cpf}'`
            );
        }
        
        await dbService.executeQuery(
            `INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
             VALUES ('${reversalId}', '${cpf}', 'REFUND', ${amount}, '${finalDescription}', '${now}')`
        );

        console.log("Buscando limite de crédito APÓS estorno...");
        const [userAfter] = await dbService.executeQuery(
            `SELECT credit_card_available_limit, balance FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`
        );
        console.log("Limite APÓS do Estorno:", userAfter.credit_card_available_limit);

        console.log("=== ESTORNO REALIZADO COM SUCESSO ===");
        if (dbService.close) await dbService.close();
        process.exit(0);

    } catch (err) {
        console.error("ERRO DURANTE O TESTE:", err);
        if (dbService.close) await dbService.close();
        process.exit(1);
    }
}

testCancel();
