const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

 // zmienne srodowiskowe z rendera
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN; 
const REDIRECT_URI = process.env.REDIRECT_URI;
const GUILD_ID = process.env.GUILD_ID; 
const ROLE_ID = process.env.ROLE_ID; 

app.get('/', (req, res) => {
    res.send('Serwer działa! Możesz się logować.');
});

 To jest ten słynny adres, do którego wraca użytkownik po zalogowaniu
app.get('callback', async (req, res) = {
    const code = req.query.code;
    if (!code) return res.send('Błąd Brak kodu autoryzacji.');

    try {
         //1. Wymieniamy kod od użytkownika na Token Dostępu
        const tokenResponse = await fetch('httpsdiscord.comapioauth2token', {
            method 'POST',
            headers { 'Content-Type' 'applicationx-www-form-urlencoded' },
            body new URLSearchParams({
                client_id CLIENT_ID,
                client_secret CLIENT_SECRET,
                grant_type 'authorization_code',
                code code,
                redirect_uri REDIRECT_URI,
            }),
        });
        
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) return res.send('Błąd Nieudana autoryzacja.');

         //2. pobieranie id uzytkownika
        const userResponse = await fetch('httpsdiscord.comapiusers@me', {
            headers { Authorization `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

         //3. Sprawdza czy osoba jest na serwerze
        const memberResponse = await fetch(`httpsdiscord.comapiguilds${GUILD_ID}members${userData.id}`, {
            headers { Authorization `Bot ${BOT_TOKEN}` },
        });

        if (memberResponse.status === 404) {
            return res.send(`Witaj ${userData.username}! Nie ma Cię na naszym głównym serwerze.`);
        }

        const memberData = await memberResponse.json();
        const userRoles = memberData.roles;

         //4. test czy ma range
        if (userRoles.includes(ROLE_ID)) {
            res.send(`h1 style=colorgreen;Sukces!h1pWitaj ${userData.username}, posiadasz wymaganą rangę.p`);
        } else {
            res.send(`h1 style=colorred;Odmowa!h1pWitaj ${userData.username}, niestety nie posiadasz rangi.p`);
        }

    } catch (error) {
        console.error(error);
        res.send('Wystąpił błąd serwera.');
    }
});

app.listen(PORT, () = console.log(`Nasłuchiwanie na porcie ${PORT}`));
