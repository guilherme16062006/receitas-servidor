require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.post('/parse-recipe', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Informe um link válido.' });
    }

    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!pageResponse.ok) {
      return res.status(400).json({ error: 'Não foi possível acessar a página da receita.' });
    }

    const html = await pageResponse.text();
    const cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 25000);

    const prompt = `
Você é um assistente de culinária rigoroso e literal. Sua única função é extrair e organizar a receita usando EXCLUSIVAMENTE o que consta no conteúdo abaixo (descrição, texto da página, fala/transcrição ou referências visuais/de imagem presentes no texto).

REGRAS ESTRITAS CONTRA INVENÇÃO:
1. NUNCA invente ingredientes, quantidades ou receitas que não estejam no conteúdo (por exemplo, se o conteúdo for de bolo, jamais invente estrogonofe ou ingredientes que não aparecem).
2. Não adicione ingredientes extras "por conta própria" nem assuma itens ausentes. Se um ingrediente ou quantidade não aparecer no conteúdo, escreva exatamente que não foi informado no conteúdo em vez de inventar.
3. "title": Coloque o nome exato ou mais fiel possível da receita encontrada no conteúdo.
4. "category": Sugira uma pasta (ex.: "Petisco", "Almoço", "Janta", "Sobremesas", "Lanche") apenas se fizer sentido com o prato encontrado; se não der para saber com segurança, use "Geral".
5. "ingredients": Liste APENAS os ingredientes mencionados no conteúdo, mantendo as quantidades exatas e o modo/forma de preparo ou apresentação (ex.: ralado, picado, fatiado, derretido, etc.) apenas quando isso constar no conteúdo. Se a quantidade ou forma não estiver clara no conteúdo, indique explicitamente que não foi especificada no material.
6. "steps": Descreva o modo de preparo detalhado e claro com base APENAS nas ações, falas, descrições ou informações visuais presentes no conteúdo. Não acrescente etapas inventadas que não estejam apoiadas no material. Se o conteúdo for insuficiente ou vazio, deixe isso claro nos passos em vez de criar uma receita fictícia.

Responda APENAS com um JSON válido neste formato exato:
{
  "title": "Nome da receita",
  "category": "Pasta sugerida",
  "ingredients": ["ingrediente exatamente como consta no conteúdo"],
  "steps": ["passo 1 baseado apenas no conteúdo", "passo 2 baseado apenas no conteúdo"]
}

Conteúdo extraído:
${cleanText}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text);

    return res.json({
      title: parsed.title || 'Receita Importada',
      category: parsed.category || 'Geral',
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    });
  } catch (err) {
    console.error('Erro ao processar receita:', err);
    return res.status(500).json({ error: 'Erro ao interpretar a receita com o Gemini.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
