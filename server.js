const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// --- CONFIGURAÇÃO DO SERVIDOR ---
const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = 'database.json';

function lerBanco() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function salvarBanco(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- ROTAS DO SITE (Mantidas para o Python funcionar) ---
app.post('/add-key', (req, res) => {
    const { key, url, filename } = req.body;
    let db = lerBanco();
    if (db.find(item => item.key === key)) return res.json({ success: false, message: 'Key já existe!' });
    db.push({ key, url, filename });
    salvarBanco(db);
    res.json({ success: true, message: 'Key vinculada!' });
});

app.get('/get-info/:key', (req, res) => {
    const key = req.params.key;
    const db = lerBanco();
    const entry = db.find(item => item.key === key);
    if (entry) res.json({ success: true, url: entry.url, filename: entry.filename });
    else res.status(404).json({ success: false, message: "Key não encontrada" });
});

// --- CONFIGURAÇÃO DO BOT DISCORD ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel] 
});

client.on('ready', () => {
    console.log(`Bot logado como ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    // Ignora mensagens do próprio bot
    if (message.author.bot) return;

    // COMANDO: !add KEY (com arquivo anexado)
    if (message.content.startsWith('!add')) {
        const args = message.content.split(' ');
        const key = args[1]; // Pega o que vem depois do !add

        // Validações
        if (!key) {
            return message.reply('❌ **Erro:** Digite a key. Exemplo: `!add VIP1` (e anexe o arquivo).');
        }

        if (message.attachments.size === 0) {
            return message.reply('❌ **Erro:** Você precisa arrastar o arquivo junto com a mensagem!');
        }

        // Pega o primeiro arquivo enviado
        const attachment = message.attachments.first();
        const fileUrl = attachment.url;
        const fileName = attachment.name;

        // Salva no Banco de Dados
        let db = lerBanco();

        if (db.find(item => item.key === key)) {
            return message.reply(`⚠️ A Key **${key}** já existe! Use outro nome.`);
        }

        db.push({ key: key, url: fileUrl, filename: fileName });
        salvarBanco(db);

        return message.reply(`✅ **Sucesso!**\nArquivo: \`${fileName}\`\nKey: \`${key}\`\n\nJá está funcionando no Launcher! 🚀`);
    }

    // COMANDO: !list (Para ver as keys criadas)
    if (message.content === '!list') {
        const db = lerBanco();
        if (db.length === 0) return message.reply("Nenhuma key cadastrada.");
        
        let msg = "**Keys Ativas:**\n";
        db.forEach(item => {
            msg += `🔑 ${item.key} -> 📄 ${item.filename}\n`;
        });
        return message.reply(msg);
    }
});

// --- INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;

// Inicia o Servidor Web
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
// Mude a última linha para ficar EXATAMENTE assim:
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; 
client.login(DISCORD_TOKEN);