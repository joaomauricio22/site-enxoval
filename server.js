const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORTA = process.env.PORT || 3000;

// 🔗 LINK DA SUA PLANILHA PUBLICADA COMO CSV NO GOOGLE SHEETS
const URL_PLANILHA_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRWaRNMyg0a8t1NROyYxMPhbfQK-dTePXyhChQ4fdNBQOrqfDwQkBELXGu8ftRDAlNAwM9eNhIPl3MJ/pub?gid=1350173655&single=true&output=csv';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const CAMINHO_RECADOS = path.join(__dirname, 'recados.json');

function lerArquivo(caminho, dadoPadrao) {
  try {
    if (!fs.existsSync(caminho)) {
      fs.writeFileSync(caminho, JSON.stringify(dadoPadrao, null, 2));
      return dadoPadrao;
    }
    return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
  } catch (erro) {
    return dadoPadrao;
  }
}

function salvarArquivo(caminho, dados) {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
}

// Função para buscar e converter o CSV do Google Sheets em JSON de Presentes
async function buscarPresentesDaPlanilha() {
  try {
    const resposta = await fetch(URL_PLANILHA_CSV);
    const textoCSV = await resposta.text();

    const linhas = textoCSV.trim().split('\n');
    linhas.shift(); // Remove a linha do cabeçalho ('Categoria', 'Item', etc.)

    const presentes = linhas.map((linha, index) => {
      // Separa as colunas respeitando vírgulas dentro de textos
      const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

      const categoria = (colunas[0] || '').replace(/"/g, '').trim();
      const item = (colunas[1] || '').replace(/"/g, '').trim();
      const marcaModelo = (colunas[2] || '').replace(/"/g, '').trim();
      
      // Converte preço
      let precoTexto = (colunas[3] || '0').replace(/"/g, '').replace('R$', '').trim();
      precoTexto = precoTexto.replace('.', '').replace(',', '.');
      const preco = parseFloat(precoTexto) || 0;

      const status = (colunas[9] || '').replace(/"/g, '').trim();
      
      // 📸 LÊ A COLUNA DE IMAGEM (COLUNA 11 / ÍNDICE 10)
      const linkImagem = (colunas[10] || '').replace(/"/g, '').trim();

      // Considera comprado se o status na planilha for "Recebido" ou "A caminho"
      const jaComprado = (status === 'Recebido' || status === 'A caminho');

      // Imagem padrão caso a célula da planilha esteja vazia
      const imagemPadrao = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&q=80';

      return {
        id: index + 1,
        nome: item,
        descricao: `${categoria} • ${marcaModelo}`,
        preco: preco,
        comprado: jaComprado,
        imagem: linkImagem !== '' ? linkImagem : imagemPadrao
      };
    });

    return presentes;
  } catch (erro) {
    console.error('Erro ao buscar dados do Google Sheets:', erro);
    return [];
  }
}

// --- ROTAS ---

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota GET: Busca os presentes com as fotos da planilha online
app.get('/api/presentes', async (req, res) => {
  const presentes = await buscarPresentesDaPlanilha();
  res.json(presentes);
});

// Rota GET: Busca recados
app.get('/api/recados', (req, res) => {
  const recados = lerArquivo(CAMINHO_RECADOS, []);
  res.json(recados);
});

// Rota POST: Registra o recado do convidado
app.post('/api/presentear', (req, res) => {
  const { nomeConvidado, nomePresente, mensagem } = req.body;

  const recados = lerArquivo(CAMINHO_RECADOS, []);

  const novoRecado = {
    nomeConvidado,
    nomePresente,
    mensagem: mensagem || 'Sem mensagem',
    data: new Date().toLocaleString('pt-BR')
  };

  recados.push(novoRecado);
  salvarArquivo(CAMINHO_RECADOS, recados);

  res.status(201).json({ mensagem: 'Sucesso!', dados: novoRecado });
});

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});
