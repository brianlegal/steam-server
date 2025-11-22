const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Banco de dados simples (Atenção: No plano grátis do Render, 
// esse arquivo pode resetar se o site ficar inativo por muito tempo.
// Para algo profissional, precisaria de um MongoDB gratuito).
const DB_FILE = 'database.json';

function lerBanco() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(DB_FILE));
}

// ROTA 1: Admin cadastra KEY + LINK + NOME DO ARQUIVO
app.post('/add-key', (req, res) => {
    const { key, url, filename } = req.body;
    let db = lerBanco();

    if (db.find(item => item.key === key)) {
        return res.json({ success: false, message: 'Essa Key já existe!' });
    }

    db.push({ key, url, filename });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    
    res.json({ success: true, message: 'Key vinculada com sucesso!' });
});

// ROTA 2: Python pede os dados da Key
app.get('/get-info/:key', (req, res) => {
    const key = req.params.key;
    const db = lerBanco();
    const entry = db.find(item => item.key === key);

    if (entry) {
        // Retorna o Link de download e o Nome que o arquivo deve ter
        res.json({ success: true, url: entry.url, filename: entry.filename });
    } else {
        res.status(404).json({ success: false, message: "Key não encontrada" });
    }
});

// Porta padrão do Render é a variável PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});