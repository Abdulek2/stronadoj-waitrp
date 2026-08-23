const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// --- WŁASNA OBSŁUGA CORS ---
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://waitrp-doj.bolt.host');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware do odczytywania JSON
app.use(express.json());

// Konfiguracja bota Discord
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

// Zmienne środowiskowe na role i kanały
const ROLE_APLIKANT_ID = process.env.ROLE_APLIKANT_ID;
const ROLE_DOJ_ID = process.env.ROLE_DOJ_ID;
const ROLE_OBYWATEL_ID = process.env.ROLE_OBYWATEL_ID;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID;

app.get('/', (req, res) => {
    res.send('Serwer dziala! Mozesz sie logowac.');
});

// Endpoint: Przyjmij gracza
app.post('/api/accept', async (req, res) => {
    const { discordId } = req.body;
    if (!discordId) return res.status(400).json({ error: 'Brak discordId' });

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId);

        await member.roles.add([ROLE_APLIKANT_ID, ROLE_DOJ_ID]);

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

// Endpoint: Zwolnij gracza
app.post('/api/fire', async (req, res) => {
    const { discordId } = req.body;
    if (!discordId) return res.status(400).json({ error: 'Brak discordId' });

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId);

        await member.roles.set([ROLE_OBYWATEL_ID]);

        res.json({ success: true });
    } catch (error) {
        console.error('Błąd przy zwalnianiu:', error);
       res.status(500).json({ error: 'Nie udało się odebrać ról.' });
    }
});

// Strona callback po autoryzacji OAuth2 z rygorystycznym sprawdzaniem serwera i ról
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

        // Pobranie danych użytkownika z Discorda
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        // Sprawdzenie czy użytkownik należy do serwera (GUILD_ID) przez API bota
        const memberResponse = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });

        if (memberResponse.status === 404) {
            // Użytkownik nie jest na serwerze Discord
            return res.redirect(`${FRONTEND_URL}?status=not_in_guild&discordId=${userData.id}&username=${encodeURIComponent(userData.username)}`);
        }

        if (!memberResponse.ok) {
            // W razie innego błędu API
            return res.redirect(`${FRONTEND_URL}?status=server_error`);
        }

        const memberData = await memberResponse.json();
        const userRoles = memberData.roles || [];

        const displayName = memberData.nick || userData.global_name || userData.username;
        const avatarUrl = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : '';

        // Weryfikacja ról: Użytkownik musi posiadać rolę Obywatel (ROLE_OBYWATEL_ID) lub uprawnioną rolę dostępu (ROLE_ID)
        const hasAccessRole = userRoles.includes(ROLE_OBYWATEL_ID) || userRoles.includes(ROLE_ID);

        if (hasAccessRole) {
            // Sukces: użytkownik jest na serwerze i ma odpowiednią rolę
            res.redirect(`${FRONTEND_URL}?status=success&discordId=${userData.id}&username=${encodeURIComponent(userData.username)}&displayName=${encodeURIComponent(displayName)}&avatar=${encodeURIComponent(avatarUrl)}`);
        } else {
            // Odmowa: użytkownik jest na serwerze, ale NIE ma roli Obywatel
            res.redirect(`${FRONTEND_URL}?status=denied&discordId=${userData.id}&username=${encodeURIComponent(userData.username)}&displayName=${encodeURIComponent(displayName)}`);
        }

    } catch (error) {
        console.error("Błąd w callbacku:", error);
        res.redirect(`${FRONTEND_URL}?status=server_error`);
    }
});

app.listen(PORT, () => console.log(`Nasluchiwanie na porcie ${PORT}`));
