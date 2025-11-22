const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = 'database.json';

// Estrutura do Banco:
// {
//   "activation_keys": ["KEY-123", "KEY-456"],
//   "users": {
//     "steam_nick_do_cara": { "files": [ {url, filename} ] }
//   }
// }

function lerBanco() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ activation_keys: [], users: {} }));
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function salvarBanco(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- API PARA O PYTHON ---

// Rota 1: Verifica se o usuário tem assinatura e retorna os arquivos dele
app.get('/get-user-library/:steam_nick', (req, res) => {
    const nick = req.params.steam_nick;
    const db = lerBanco();

    // Verifica se o usuário existe no banco (tem assinatura)
    if (db.users[nick]) {
        res.json({ 
            success: true, 
            files: db.users[nick].files 
        });
    } else {
        res.json({ 
            success: false, 
            message: "Usuário sem assinatura ativa." 
        });
    }
});

// --- BOT DISCORD ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Necessário para boas-vindas
    ],
    partials: [Partials.Channel] 
});

// 1. SAUDAÇÃO (Boas-vindas)
client.on('guildMemberAdd', member => {
    const channel = member.guild.channels.cache.find(ch => ch.name === 'geral' || ch.name === 'general');
    if (channel) {
        channel.send(`👋 Bem-vindo(a) ${member}! Para usar nosso injetor, você precisa de uma **Chave de Ativação**. Fale com o Admin!`);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0].toLowerCase();
    const db = lerBanco();

    // --- COMANDOS DO DONO (MASTER) ---
    
    // !gerar <quantidade> <senha_mestre>
    if (command === '!gerar') {
        const qtd = parseInt(args[1]);
        const pass = args[2];

        if (pass !== process.env.MASTER_KEY) return message.reply("❌ Senha Mestre incorreta.");
        if (!qtd || isNaN(qtd)) return message.reply("❌ Diga a quantidade. Ex: `!gerar 5 SENHA`");

        let novasKeys = [];
        for (let i = 0; i < qtd; i++) {
            // Gera uma key aleatória (Ex: KEY-A1B2)
            const key = "KEY-" + Math.random().toString(36).substring(2, 6).toUpperCase();
            db.activation_keys.push(key);
            novasKeys.push(key);
        }
        salvarBanco(db);
        
        // Manda na DM do Admin para ninguém roubar
        message.author.send(`🔑 **Chaves Geradas:**\n${novasKeys.join('\n')}`);
        return message.reply("✅ Chaves enviadas na sua DM!");
    }

    // !painel <senha_mestre> (Ver quem assinou)
    if (command === '!painel') {
        if (args[1] !== process.env.MASTER_KEY) return message.reply("❌ Acesso negado.");
        
        let lista = "**📋 Assinantes Ativos:**\n";
        const users = Object.keys(db.users);
        if (users.length === 0) lista += "Ninguém ainda.";
        
        users.forEach(u => {
            lista += `👤 **${u}** - Arquivos: ${db.users[u].files.length}/101\n`;
        });
        return message.reply(lista);
    }

    // --- COMANDOS DO CLIENTE ---

    // !ativar <CHAVE> <STEAM_NICK>
    if (command === '!ativar') {
        const key = args[1];
        const nick = args[2];

        if (!key || !nick) return message.reply("❌ Uso correto: `!ativar CHAVE SEU_NICK_STEAM`");

        // Verifica se a chave existe
        const keyIndex = db.activation_keys.indexOf(key);
        if (keyIndex === -1) return message.reply("❌ Chave inválida ou já usada.");

        // Verifica se o nick já tem conta
        if (db.users[nick]) return message.reply("⚠️ Esse Nick já possui uma assinatura ativa!");

        // ATIVAÇÃO
        db.activation_keys.splice(keyIndex, 1); // Remove a chave usada
        db.users[nick] = { files: [] }; // Cria a conta do usuário
        salvarBanco(db);

        return message.reply(`✅ **Sucesso!** Assinatura ativada para o Steam Nick: **${nick}**.\nAgora você pode enviar arquivos com \`!add\`.`);
    }

    // !add (Com anexo) - Adiciona na biblioteca do usuário
    if (command === '!add') {
        // O usuário precisa dizer o nick dele para confirmar (segurança básica)
        // Ou idealmente, vincularíamos o ID do Discord ao Nick, mas vamos manter simples:
        const nick = args[1];

        if (!nick) return message.reply("❌ Diga seu nick. Ex: `!add MEU_NICK` (e anexe o arquivo).");
        if (!db.users[nick]) return message.reply("❌ Você não tem assinatura ativa para este Nick.");
        
        if (message.attachments.size === 0) return message.reply("❌ Anexe o arquivo!");

        const userLib = db.users[nick].files;
        if (userLib.length >= 101) return message.reply("❌ Limite de 101 arquivos atingido!");

        const attachment = message.attachments.first();
        
        // Salva na biblioteca DO USUÁRIO
        userLib.push({
            url: attachment.url,
            filename: attachment.name
        });
        salvarBanco(db);

        return message.reply(`✅ Arquivo **${attachment.name}** adicionado à biblioteca de **${nick}**! (${userLib.length}/101)`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));

const DISCORD_TOKEN = process.env.DISCORD_TOKEN; 
client.login(DISCORD_TOKEN);