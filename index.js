const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const cors = require('cors'); // <--- DODANE
const app = express();
const PORT = process.env.PORT || 3000;

// Konfiguracja CORS (zapobiega blokowaniu zapytań ze strony)
app.use(cors({
    origin: [
        'https://waitrp-doj.bolt.host', 
        'http://localhost:3000', 
        'http://localhost:5173'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Ważne: middleware do odczycywania JSON z zapytań ze strony
app.use(express.json());

// Konfiguracja bota Discord (potrzebne uprawnienia do zarządzania członkami/rolami)
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers
    ] 
});

const BOT_STATUS_TEXT = "Wpisz tutaj swój status"; 
const BOT_STATUS_TYPE = ActivityType.Playing; 

client.once('ready', () => {
    console.log(`Bot zalogowany jako ${client.user.tag}!`);
    client.user.setPresence({
        activities: [{ name: BOT_STATUS_TEXT, type: BOT_STATUS_TYPE }],
        status: 'online',
    });
});

client.login(process.env.BOT_TOKEN);

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN; 
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID; 
const ROLE_ID = process.env.ROLE_ID; 
const FRONTEND_URL = process.env.FRONTEND_URL; 

// Nowe zmienne środowiskowe na role i kanały
const ROLE_APLIKANT_ID = process.env.ROLE_APLIKANT_ID;
const ROLE_DOJ_ID = process.env.ROLE_DOJ_ID;
const ROLE_OBYWATEL_ID = process.env.ROLE_OBYWATEL_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID;

app.get('/', (req, res) => {
    res.send('Serwer dziala! Mozesz sie logowac.');
});

// Endpoint wywoływany ze strony, gdy rekruter kliknie "Przyjmij"
app.post('/api/accept', async (req, res) => {
    const { discordId } = req.body;
    if (!discordId) return res.status(400).json({ error: 'Brak discordId' });

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId);

        // 1. Nadanie ról: Aplikant i Department of Justice
        await member.roles.add([ROLE_APLIKANT_ID, ROLE_DOJ_ID]);

        // 2. Wysłanie wiadomości na wskazany kanał z oznaczeniem użytkownika
        const channel = await guild.channels.fetch(WELCOME_CHANNEL_ID);
        if (channel) {
            await channel.send(`Gratulacje <@${discordId}>, zostałeś przyjęty do departamentu! Zapoznaj się z <#${RULES_CHANNEL_ID}>.`);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Błąd przy przyjmowaniu:', error);
        res.status(500).json({ error: 'Nie udało się nadać ról lub wysłać wiadomości.' });
    }
});

// Endpoint wywoływany ze strony, gdy rekruter kliknie "Zwolnij"
app.post('/api/fire', async (req, res) => {
    const { discordId } = req.body;
    if (!discordId) return res.status(400).json({ error: 'Brak discordId' });

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId);

        // Zabranie wszystkich ról i zostawienie tylko roli Obywatel
        await member.roles.set([ROLE_OBYWATEL_ID]);

        res.json({ success: true });
    } catch (error) {
        console.error('Błąd przy zwalnianiu:', error);
        res.status(500).json({ error: 'Nie udało się odebrać ról.' });
    }
});

// Strona callback po autoryzacji OAuth2
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect(`${FRONTEND_URL}?status=error&reason=no_code`);

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
        });
        
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) return res.redirect(`${FRONTEND_URL}?status=error&reason=token_failed`);

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        const memberResponse = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });

        if (memberResponse.status === 404) {
            return res.redirect(`${FRONTEND_URL}?status=not_in_guild&discordId=${userData.id}&username=${encodeURIComponent(userData.username)}`);
        }

        const memberData = await memberResponse.json();
        const userRoles = memberData.roles;

        const displayName = memberData.nick || userData.global_name || userData.username;
        const avatarUrl = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : '';

        if (userRoles.includes(ROLE_ID)) {
            res.redirect(`${FRONTEND_URL}?status=success&discordId=${userData.id}&username=${encodeURIComponent(userData.username)}&displayName=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(avatarUrl)}`);
        } else {
            res.redirect(`${FRONTEND_URL}?status=denied&discordId=${userData.id}&username=${encodeURIComponent(userData.username)}&displayName=${encodeURIComponent(displayName)}`);
        }

    } catch (error) {
        console.error(error);
        res.redirect(`${FRONTEND_URL}?status=server_error`);
    }
});

app.listen(PORT, () => console.log(`Nasluchiwanie na porcie ${PORT}`));
