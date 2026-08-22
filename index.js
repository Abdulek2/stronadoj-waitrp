const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// zmienne srodowiskowe 
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN; 
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID; 
const ROLE_ID = process.env.ROLE_ID; 

app.get('/', (req, res) => {
    res.send('Serwer dziala! Mozesz sie logowac.');
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Błąd: Brak kodu autoryzacji.');

    try {
        // 1. wymiana kodu od uzytkownika na Token Dostepu
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
        if (!tokenData.access_token) return res.send('Błąd: Nieudana autoryzacja.');

        // 2. pobieranie id uzytkownika
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        // 3. sprawdza czy uzytkownik na serwerze
        const memberResponse = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });

        if (memberResponse.status === 404) {
            return res.send(`Witaj ${userData.username}! Nie ma Cię na naszym glownym serwerze.`);
        }

        const memberData = await memberResponse.json();
        const userRoles = memberData.roles;

        // 4. sprawdzamy czy uzytkownik ma range
        if (userRoles.includes(ROLE_ID)) {
            res.send(`<h1 style="color:green;">Sukces!</h1><p>Witaj ${userData.username}, posiadasz wymagana range.</p>`);
        } else {
            res.send(`<h1 style="color:red;">Odmowa!</h1><p>Witaj ${userData.username}, niestety nie posiadasz rangi.</p>`);
        }

    } catch (error) {
        console.error(error);
        res.send('Wystapil blad serwera.');
    }
});

app.listen(PORT, () => console.log(`Nasluchiwanie na porcie ${PORT}`));
