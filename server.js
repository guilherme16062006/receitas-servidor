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
Você é um assistente de culinária extremamente detalhista e prático. Como quem vai cozinhar não tem o vídeo na frente o tempo todo, a receita precisa ser explicada com riqueza de detalhes para não restar dúvida sobre o que fazer.

Analise o conteúdo extraído abaixo e gere uma receita completa seguindo TODAS estas regras:
1. "title": Escreva o nome claro e específico do prato.
2. "category": Indique em qual pasta/categoria o prato se encaixa melhor (por exemplo: "Petisco", "Almoço", "Janta", "Sobremesas", "Café da Manhã / Lanche").
3. "ingredients": Liste TODOS os ingredientes necessários. Sempre que houver quantidade ou medida no conteúdo/vídeo/descrição, coloque exatamente essa quantidade. Quando não houver quantidade exata, coloque uma quantidade prática estimada e explique a forma e o preparo prévio de cada ingrediente (ex.: se o queijo deve ser ralado, picado em cubos ou fatiado; se a batata deve ser cozida e amassada ou ralada; se a carne/tempero deve ser picado fino, etc.). Inclua também ingredientes básicos ou de apoio necessários para o preparo (como sal, óleo, água ou farinha para dar liga), sinalizando quando for sugestão.
4. "steps": Escreva o modo de preparo passo a passo de forma bem detalhada, clara e didática, como se estivesse ensinando alguém passo a passo na cozinha. Explique a forma de fazer cada etapa, o formato/tamanho das porções (por exemplo, como modelar em palitos, bolinhas ou porções), a textura/ponto esperado e os cuidados para não errar (como temperatura, tempo aproximado, não queimar ou não vazar o recheio). Quando algum detalhe ou medida não constar explicitamente no material, preencha com uma técnica ou medida padrão de cozinha e deixe indicado que é uma sugestão para ajustar ao gosto.

Responda APENAS com um JSON válido neste formato exato:
{
  "title": "Nome do prato",
  "category": "Pasta sugerida (ex.: Petisco, Almoço, Janta, Sobremesas)",
  "ingredients": ["ingrediente 1 com quantidade e forma/preparo", "ingrediente 2 com quantidade e forma/preparo"],
  "steps": ["passo 1 detalhado", "passo 2 detalhado"]
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
