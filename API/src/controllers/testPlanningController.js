/**
 * testPlanningController.js — handlers de GET/POST do Planejamento de Testes
 * (cruza TBL_CENARIOS x tbl_de_massas de MassaDados.xlsx).
 */
const { readPlanningData, saveCenarioAssignment } = require('../../utils/testPlanningXlsx.cjs');
const { validarMassaParaCenario } = require('../../utils/testPlanningRules.cjs');

module.exports = function createTestPlanningController(deps) {
    const { auditLog } = deps;

    const getPlanningData = async (req, res) => {
        try {
            const { cenarios, massas } = readPlanningData();
            res.json({ success: true, data: { cenarios, massas } });
        } catch (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).json({
                    success: false,
                    message: 'MassaDados.xlsx não encontrado. Verifique se o repo poc-fintech-playwright está no caminho esperado.',
                });
            }
            res.status(500).json({ success: false, message: 'Erro ao ler MassaDados.xlsx: ' + err.message });
        }
    };

    const saveAssignment = async (req, res) => {
        const { idCenario, massa } = req.body || {};
        if (!idCenario || !massa || !massa.cpf) {
            return res.status(400).json({ success: false, message: 'idCenario e massa (com cpf) são obrigatórios.' });
        }

        // DESLIGADO a pedido (2026-09-14): saveCenarioAssignment() reconstrói
        // TBL_CENARIOS do zero via XLSX.utils.json_to_sheet + XLSX.writeFile —
        // o mesmo padrão que já apagou a formatação de TBL_CADASTRO uma vez em
        // poc-fintech-playwright/packages/gerador-massa-unificado/scripts/corrigirTblCadastro.ts.
        // Todas as abas de MassaDados.xlsx agora são tabela dinâmica + fórmulas
        // de correlação — não pode arriscar de novo. Religar só depois de portar
        // o append seguro (PizZip, preserva Tabela) de
        // poc-fintech-playwright/tests/utils/excelTableAppender.ts. Lógica original
        // preservada comentada abaixo, pra restaurar quando o save seguro estiver pronto.
        return res.status(503).json({
            success: false,
            message: 'Salvar no xlsx está temporariamente desligado: a escrita atual reconstrói a aba TBL_CENARIOS e apagaria a tabela dinâmica/fórmulas da planilha.',
        });

        /*
        const campos = {
            ID_MASSA: massa.idMassa,
            CPF: massa.cpf,
            saldo_conta: massa.saldoConta,
            fatura_fechada: massa.faturaFechada,
            fatura_aberta: massa.faturaAberta,
            dias_atraso: massa.diasAtraso,
            PIN: massa.pin,
        };
        try {
            // Não-bloqueante de propósito: o resultado só vai pro audit log,
            // a massa é salva independente de `valido`.
            const resultadoValidacao = validarMassaParaCenario(idCenario, campos);
            const linhaAtualizada = saveCenarioAssignment(idCenario, campos);
            auditLog(req, 'admin_test_planning_save', 'info', { idCenario, cpf: massa.cpf, validacao: resultadoValidacao });
            res.json({ success: true, data: linhaAtualizada });
        } catch (err) {
            if (err.code === 'EBUSY' || err.code === 'EPERM') {
                return res.status(503).json({
                    success: false,
                    message: 'MassaDados.xlsx está aberto no Excel. Feche o arquivo e tente novamente.',
                });
            }
            res.status(500).json({ success: false, message: 'Erro ao salvar em TBL_CENARIOS: ' + err.message });
        }
        */
    };

    return { getPlanningData, saveAssignment };
};
