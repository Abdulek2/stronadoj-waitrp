const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Konfiguracja bota Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

// Zmienne środowiskowe z ustawień hostingu
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN; 
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID; 
const ROLE_ID = process.env.ROLE_ID; 
const FRONTEND_URL = process.env.FRONTEND_URL; // Adres Twojej strony z Bolta

app.get('/', (req, res) => {
    res.send('Serwer dziala! Mozesz sie logowac.');
});

// Strona callback po autoryzacji OAuth2 - teraz robi PRZEKIEROWANIE na Twoją stronę
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
            return res.redirect(`${FRONTEND_URL}?status=not_in_guild&username=${encodeURIComponent(userData.username)}`);
        }

        const memberData = await memberResponse.json();
        const userRoles = memberData.roles;

        if (userRoles.includes(ROLE_ID)) {
            res.redirect(`${FRONTEND_URL}?status=success&username=${encodeURIComponent(userData.username)}`);
        } else {
            res.redirect(`${FRONTEND_URL}?status=denied&username=${encodeURIComponent(userData.username)}`);
        }

    } catch (error) {
        console.error(error);
        res.redirect(`${FRONTEND_URL}?status=server_error`);
    }
});

app.listen(PORT, () => console.log(`Nasluchiwanie na porcie ${PORT}`));
