import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON body parser for incoming requests
  app.use(express.json());

  // API Route: Spending Pattern Analysis using Gemini API
  app.post("/api/gemini/analyze-spending", async (req, res) => {
    try {
      const { transactions } = req.body || {};
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ error: "Nenhuma transação enviada para análise." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Return a friendly fallback analysis if the API key is not yet set
        const totalSpend = transactions
          .filter((t: any) => t.type === 'expense')
          .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        
        return res.json({
          analysis: `[Modo de Demonstração] Com base nas suas transações recentes, observamos despesas acumuladas de R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em categorias como alimentação e transporte.`,
          actionableTip: "Dica de Economia: Tente planejar suas refeições semanais ou usar transporte público/carona compartilhada em dias fixos para poupar até R$ 200,00 por mês.",
          demoMode: true
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Analise as transações recentes deste usuário para fornecer uma análise de padrões de gastos curta (máximo de 3 parágrafos simples), amigável e em português do Brasil. Em seguida, ofereça exatamente uma dica acionável, relevante e criativa para ajudá-lo a economizar mais com base no seu histórico.

Histórico de transações recentes:
${JSON.stringify(transactions, null, 2)}
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.STRING,
                description: "Breve análise do comportamento de consumo do usuário em português. Amigável e objetiva."
              },
              actionableTip: {
                type: Type.STRING,
                description: "Exatamente uma dica acionável e realista baseada em seus gastos para economizar dinheiro no curto prazo."
              }
            },
            required: ["analysis", "actionableTip"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return res.json(data);
      } else {
        throw new Error("Resposta da IA vazia.");
      }
    } catch (error: any) {
      console.error("Erro na rota de análise:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor." });
    }
  });

  // API Route: Analyze recurring subscriptions & potential missed bills
  app.post("/api/gemini/analyze-recurring", async (req, res) => {
    try {
      const { transactions, recurringBills } = req.body || {};
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Find potential recurring items from actual transaction history
        const billTitlesLower = (recurringBills || []).map((b: any) => b.title.toLowerCase());
        const txCounts: Record<string, { count: number, amounts: number[], category: string }> = {};
        
        for (const tx of transactions || []) {
          if (tx.type !== 'expense') continue;
          const desc = tx.description.trim();
          const descLower = desc.toLowerCase();
          
          // Skip if already in recurring bills
          const alreadyTracked = billTitlesLower.some((bt: string) => descLower.includes(bt) || bt.includes(descLower));
          if (alreadyTracked) continue;
          
          if (!txCounts[desc]) {
            txCounts[desc] = { count: 0, amounts: [], category: tx.category };
          }
          txCounts[desc].count++;
          txCounts[desc].amounts.push(Math.abs(tx.amount));
        }

        const missedSubscriptions = [];
        for (const [title, info] of Object.entries(txCounts)) {
          if (info.count >= 2) {
            const avgAmount = info.amounts.reduce((a, b) => a + b, 0) / info.amounts.length;
            missedSubscriptions.push({
              title,
              estimatedAmount: parseFloat(avgAmount.toFixed(2)),
              frequency: "Mensal",
              reason: `Identificamos ${info.count} cobranças com este nome no seu extrato recente, mas ela não está na sua lista de Contas Recorrentes.`
            });
          }
        }

        // Add interesting default ones if none are detected
        if (missedSubscriptions.length === 0) {
          missedSubscriptions.push({
            title: "Disney+ Streaming",
            estimatedAmount: 43.90,
            frequency: "Mensal",
            reason: "Cobrança mensal frequente que costuma passar despercebida após períodos de teste."
          });
          missedSubscriptions.push({
            title: "Adobe Creative Cloud",
            estimatedAmount: 124.00,
            frequency: "Mensal",
            reason: "Uma assinatura de alto valor que pode ser pausada se você não usar profissionalmente todos os meses."
          });
        }

        const potentialCancellations = [];
        const activeBills = recurringBills || [];
        for (const bill of activeBills) {
          const amt = Math.abs(bill.amount);
          const nameLower = bill.title.toLowerCase();
          if (nameLower.includes('netflix') || nameLower.includes('spotify') || nameLower.includes('gym') || nameLower.includes('pass') || nameLower.includes('academia')) {
            potentialCancellations.push({
              title: bill.title,
              amount: amt,
              reason: `Redundante ou de lazer. Você pode suspender temporariamente ou migrar para planos familiares ou com anúncios para cortar custos sem perder o serviço.`,
              savingPotential: parseFloat((amt * 0.4).toFixed(2)) // 40% optimization potential
            });
          }
        }

        if (potentialCancellations.length === 0) {
          potentialCancellations.push({
            title: "Netflix Ultra HD",
            amount: 55.90,
            reason: "Considere migrar para o plano Standard com anúncios para economizar mais de 50% todo mês.",
            savingPotential: 34.00
          });
        }

        const totalSavingsPotential = potentialCancellations.reduce((sum, item) => sum + item.savingPotential, 0);

        return res.json({
          analysis: `[Modo de Demonstração] Analisamos suas transações e contas recorrentes. Encontramos assinaturas ativas que representam oportunidades reais de otimização. Sugerimos revisar planos de streaming ou serviços de lazer para liberar margem no seu orçamento mensal.`,
          missedSubscriptions: missedSubscriptions.slice(0, 3),
          potentialCancellations: potentialCancellations.slice(0, 3),
          totalSavingsPotential: parseFloat(totalSavingsPotential.toFixed(2)),
          demoMode: true
        });
      }

      // If API key is present, use GoogleGenAI
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Você é um especialista em finanças pessoais e otimização de orçamentos.
Analise a lista de transações recentes do usuário e a lista de assinaturas/contas recorrentes já registradas para descobrir:
1. "Assinaturas ou cobranças recorrentes esquecidas/perdidas": Transações frequentes ou repetidas (mesma descrição ou parecida, valores recorrentes, ex: tarifas bancárias, assinaturas de apps, streamings, etc.) que ocorrem no histórico mas NÃO estão listadas na lista de contas recorrentes (recurringBills).
2. "Sugestões de cancelamento ou otimização": Analise as assinaturas atuais do usuário (em recurringBills) que podem ser supérfluas, redundantes ou passíveis de otimização (ex: streamings múltiplos, assinaturas caras, planos fitness) e ofereça uma justificativa clara de economia ou downgrade, calculando o potencial de economia mensal.

Por favor, forneça o resultado em português do Brasil, utilizando o formato JSON especificado.

Histórico de transações:
${JSON.stringify(transactions, null, 2)}

Contas Recorrentes atuais:
${JSON.stringify(recurringBills, null, 2)}
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.STRING,
                description: "Análise geral das assinaturas e contas recorrentes do usuário, com conselhos práticos de otimização de assinaturas. Máximo 2 parágrafos."
              },
              missedSubscriptions: {
                type: Type.ARRAY,
                description: "Cobranças repetidas que aparecem nas transações, mas não estão cadastradas como recorrentes.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    estimatedAmount: { type: Type.NUMBER },
                    frequency: { type: Type.STRING, description: "Frequência estimada (ex: Mensal, Anual)" },
                    reason: { type: Type.STRING, description: "Explicação curta do motivo de considerarmos recorrente." }
                  },
                  required: ["title", "estimatedAmount", "frequency", "reason"]
                }
              },
              potentialCancellations: {
                type: Type.ARRAY,
                description: "Assinaturas ou contas da lista de recorrentes que podem ser canceladas ou otimizadas para economizar.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    reason: { type: Type.STRING, description: "Razão detalhada explicando por que cancelar ou como economizar." },
                    savingPotential: { type: Type.NUMBER, description: "Valor em R$ que o usuário poupará por mês com essa ação." }
                  },
                  required: ["title", "amount", "reason", "savingPotential"]
                }
              },
              totalSavingsPotential: {
                type: Type.NUMBER,
                description: "Potencial total de economia somando todas as sugestões de cancelamento/otimização."
              }
            },
            required: ["analysis", "missedSubscriptions", "potentialCancellations", "totalSavingsPotential"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return res.json(data);
      } else {
        throw new Error("Resposta da IA vazia.");
      }
    } catch (error: any) {
      console.error("Erro na rota de análise recorrente:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor." });
    }
  });

  // API Route: Auto-categorize transaction description/title using Gemini API
  app.post("/api/gemini/categorize", async (req, res) => {
    try {
      const { description } = req.body || {};
      if (!description || typeof description !== "string") {
        return res.status(400).json({ error: "Descrição da transação inválida ou vazia." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Return a basic fallback local-rule-based categorization if the API key is not set
        const desc = description.toLowerCase().trim();
        let category: 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros' = 'outros';
        let reason = "Classificado automaticamente usando o motor de regras local.";
        
        if (
          desc.includes('uber') || desc.includes('99') || desc.includes('taxi') || 
          desc.includes('posto') || desc.includes('gasolina') || desc.includes('combustivel') || 
          desc.includes('metro') || desc.includes('onibus') || desc.includes('pedagio') || 
          desc.includes('estacionamento') || desc.includes('cabify') || desc.includes('carro') ||
          desc.includes('viagem') || desc.includes('buser')
        ) {
          category = 'mobilidade';
          reason = "Identificado transporte ou mobilidade na descrição (Motor Local).";
        } else if (
          desc.includes('restaurante') || desc.includes('ifood') || desc.includes('mcdonald') || 
          desc.includes('burger') || desc.includes('pizza') || desc.includes('padaria') || 
          desc.includes('supermercado') || desc.includes('mercado') || desc.includes('cafe') || 
          desc.includes('doce') || desc.includes('jantar') || desc.includes('almoco') || 
          desc.includes('esfiha') || desc.includes('comida') || desc.includes('outback') ||
          desc.includes('pao') || desc.includes('subway') || desc.includes('starbucks')
        ) {
          category = 'refeicao';
          reason = "Identificado alimentação, restaurante ou mercado na descrição (Motor Local).";
        } else if (
          desc.includes('cinema') || desc.includes('teatro') || desc.includes('netflix') || 
          desc.includes('spotify') || desc.includes('show') || desc.includes('ingresso') || 
          desc.includes('livro') || desc.includes('game') || desc.includes('jogos') || 
          desc.includes('museu') || desc.includes('disney') || desc.includes('prime video') ||
          desc.includes('steam') || desc.includes('playstation') || desc.includes('xbox') ||
          desc.includes('show') || desc.includes('evento')
        ) {
          category = 'cultura';
          reason = "Identificado entretenimento, lazer, streaming ou cultura na descrição (Motor Local).";
        } else if (
          desc.includes('farmacia') || desc.includes('drogaria') || desc.includes('medico') || 
          desc.includes('hospital') || desc.includes('dentista') || desc.includes('remedio') || 
          desc.includes('exame') || desc.includes('clinica') || desc.includes('saude') ||
          desc.includes('terapia') || desc.includes('psicologo') || desc.includes('pague menos') ||
          desc.includes('raia') || desc.includes('drogasil')
        ) {
          category = 'saude';
          reason = "Identificado gastos com saúde, farmácia ou serviços médicos (Motor Local).";
        }
        
        return res.json({ category, confidence: 0.85, reason, isFallback: true });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Classifique a seguinte descrição de transação financeira em uma das seguintes categorias permitidas:
- "refeicao" (comidas, restaurantes, delivery, supermercados, cafés, padarias, bares)
- "mobilidade" (transporte, uber, táxi, combustível, postos, metrô, ônibus, pedágio, passagens, estacionamento)
- "cultura" (cinema, teatro, shows, streaming de música/vídeo como netflix/spotify, jogos/games, livros, eventos, museus)
- "saude" (farmácias, remédios, médicos, hospitais, exames, consultas, dentista, terapia)
- "outros" (qualquer outra despesa que não se encaixe nas anteriores, taxas, transferências genéricas, faturas, etc.)

Descrição da transação: "${description}"
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                enum: ["refeicao", "mobilidade", "cultura", "saude", "outros"],
                description: "A categoria correspondente à descrição."
              },
              confidence: {
                type: Type.NUMBER,
                description: "Nível de confiança da classificação entre 0.0 e 1.0."
              },
              reason: {
                type: Type.STRING,
                description: "Uma explicação em português muito breve, de no máximo 1 frase curta, de por que essa categoria foi selecionada."
              }
            },
            required: ["category", "confidence", "reason"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return res.json(data);
      } else {
        throw new Error("Resposta da IA vazia.");
      }
    } catch (error: any) {
      console.error("Erro na rota de autocategorização:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor." });
    }
  });

  // API Route: Parse voice transcript into structured transaction fields using Gemini
  app.post("/api/gemini/parse-voice", async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Texto de voz inválido ou vazio." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        // Fallback local voice parser in Portuguese
        const rawText = text.toLowerCase().trim();
        let amount = 10.0; // default fallback amount
        let type: 'income' | 'expense' = 'expense';
        let category: 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros' = 'outros';
        let title = "Transação de Voz";

        // Try extracting numbers from speech text
        // Speech-to-text engines often yield digits directly: "gastei 55 reais", "recebi R$ 120"
        const numberMatches = rawText.match(/\d+([,.]\d+)?/g);
        if (numberMatches && numberMatches.length > 0) {
          // Parse the first found number
          const parsedNum = parseFloat(numberMatches[0].replace(',', '.'));
          if (!isNaN(parsedNum) && parsedNum > 0) {
            amount = parsedNum;
          }
        } else {
          // If no digits, look for common Portuguese spoken numbers
          const portugueseNumbers: { [key: string]: number } = {
            'um': 1, 'dois': 2, 'três': 3, 'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10,
            'quinze': 15, 'vinte': 20, 'trinta': 30, 'quarenta': 40, 'cinquenta': 50, 'cem': 100
          };
          for (const word of Object.keys(portugueseNumbers)) {
            if (rawText.includes(word)) {
              amount = portugueseNumbers[word];
              break;
            }
          }
        }

        // Determine type: income (positive) vs expense (negative)
        if (
          rawText.includes('recebi') || rawText.includes('ganhei') || rawText.includes('depositei') || 
          rawText.includes('depositar') || rawText.includes('entrada') || rawText.includes('recebimento') || 
          rawText.includes('salário') || rawText.includes('pix de') || rawText.includes('pix recebido') || 
          rawText.includes('receber') || rawText.includes('ganhar')
        ) {
          type = 'income';
        } else {
          type = 'expense';
          amount = -amount;
        }

        // Determine category & title
        if (
          rawText.includes('uber') || rawText.includes('99') || rawText.includes('táxi') || 
          rawText.includes('posto') || rawText.includes('gasolina') || rawText.includes('combustível') || 
          rawText.includes('metrô') || rawText.includes('ônibus') || rawText.includes('pedágio') || 
          rawText.includes('estacionamento') || rawText.includes('passagem') || rawText.includes('carro')
        ) {
          category = 'mobilidade';
          title = rawText.includes('uber') ? 'Corrida Uber' : rawText.includes('99') ? 'Corrida 99' : rawText.includes('gasolina') ? 'Combustível' : 'Mobilidade / Transporte';
        } else if (
          rawText.includes('restaurante') || rawText.includes('ifood') || rawText.includes('mcdonald') || 
          rawText.includes('burger') || rawText.includes('pizza') || rawText.includes('padaria') || 
          rawText.includes('supermercado') || rawText.includes('mercado') || rawText.includes('café') || 
          rawText.includes('comida') || rawText.includes('almoço') || rawText.includes('jantar')
        ) {
          category = 'refeicao';
          title = rawText.includes('ifood') ? 'Delivery iFood' : rawText.includes('mercado') ? 'Supermercado' : rawText.includes('almoço') ? 'Almoço' : 'Refeição / Alimentação';
        } else if (
          rawText.includes('cinema') || rawText.includes('teatro') || rawText.includes('netflix') || 
          rawText.includes('spotify') || rawText.includes('show') || rawText.includes('ingresso') || 
          rawText.includes('jogo') || rawText.includes('game') || rawText.includes('livro')
        ) {
          category = 'cultura';
          title = rawText.includes('netflix') ? 'Streaming Netflix' : rawText.includes('spotify') ? 'Streaming Spotify' : 'Cultura e Lazer';
        } else if (
          rawText.includes('farmácia') || rawText.includes('drogaria') || rawText.includes('médico') || 
          rawText.includes('hospital') || rawText.includes('dentista') || rawText.includes('remédio') || 
          rawText.includes('exame') || rawText.includes('saúde')
        ) {
          category = 'saude';
          title = rawText.includes('farmácia') || rawText.includes('drogaria') ? 'Farmácia' : 'Serviços de Saúde';
        } else {
          // Generic cleaning for title
          // Try to remove common prefix fillers
          let cleanTitle = text
            .replace(/(gastei|comprei|paguei|recebi|depositei|recebimento de|pagamento de|compra de|um|uma|com|no|na|em|o|a|de|reais|\d+|r\$)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (cleanTitle.length > 2) {
            // Capitalize first letter
            title = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
          } else {
            title = type === 'income' ? 'Depósito por Voz' : 'Despesa por Voz';
          }
        }

        const absAmountText = Math.abs(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        return res.json({
          title,
          amount,
          type,
          category,
          reason: `Processado localmente: Detectado valor R$ ${absAmountText} na categoria ${category}.`,
          confidence: 0.8,
          isFallback: true
        });
      }

      // API Key is present, use Gemini model
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Analise a transcrição de áudio a seguir que descreve uma transação financeira recente (em português). Extraia as seguintes informações no formato JSON especificado:
1. O título limpo e legível da transação (ex: "Passagem de Metrô" ou "Almoço iFood"). Remova palavras de ação como "comprei", "gastei", "paguei".
2. O valor numérico da transação (SEMPRE positivo se for ganho/entrada, SEMPRE negativo se for gasto/despesa).
3. O tipo ("income" se for recebimento/depósito/salário, "expense" se for gasto/compra/pagamento).
4. A categoria correspondente apenas entre estas opções: "refeicao", "mobilidade", "cultura", "saude", ou "outros".
5. O motivo da decisão de categoria e valor de forma muito resumida.

Se não encontrar um valor, use -10.00 como padrão para despesas e +10.00 para receitas.

Texto de áudio falado: "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "Título curto, limpo e bem formatado da transação."
              },
              amount: {
                type: Type.NUMBER,
                description: "Valor numérico (positivo para receitas, negativo para despesas/gastos)."
              },
              type: {
                type: Type.STRING,
                enum: ["income", "expense"],
                description: "O tipo da transação."
              },
              category: {
                type: Type.STRING,
                enum: ["refeicao", "mobilidade", "cultura", "saude", "outros"],
                description: "A categoria correspondente."
              },
              reason: {
                type: Type.STRING,
                description: "Breve explicação em português (uma frase) de como esses campos foram identificados."
              },
              confidence: {
                type: Type.NUMBER,
                description: "Grau de confiança de 0.0 a 1.0."
              }
            },
            required: ["title", "amount", "type", "category", "reason", "confidence"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        return res.json(data);
      } else {
        throw new Error("Resposta do Gemini vazia.");
      }
    } catch (error: any) {
      console.error("Erro na rota de processamento de voz:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Development server mode with Vite middleware enabled.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production server mode serving built assets.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
