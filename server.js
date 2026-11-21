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
Extraia a receita deste conteúdo de página e responda APENAS com um JSON válido neste formato exato:
{
  "title": "Nome da receita",
  "ingredients": ["ingrediente 1", "ingrediente 2"],
  "steps": ["passo 1", "passo 2"]
}

Conteúdo da página:
${cleanText}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text);

    return res.json({
      title: parsed.title || 'Receita Importada',
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