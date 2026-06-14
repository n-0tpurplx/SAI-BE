import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // If using Node 18+, you can remove this import and use global fetch

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8888;

// Enable CORS so your GitHub Pages frontend can communicate with this API
app.use(cors({
    origin: ['https://your-username.github.io', 'http://127.0.0.1:5500'], // Add your GitHub pages domain here
    credentials: true
}));
app.use(express.json());

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

app.get('/', (req, res) => {
    res.send('Songify AI Node Backend is running!');
});

// Route 1: Direct your user here to kick off the login
app.get('/login', (req, res) => {
    const scope = 'playlist-modify-public playlist-modify-private';
    
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        show_dialog: 'true'
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// Route 2: Where Spotify sends the user back with an temporary auth code
app.get('/callback', async (req, res) => {
    const code = req.query.code || null;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
    }

    try {
        // Exchange the temporary code for actual access tokens
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
            },
            body: new URLSearchParams({
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Send the access token back to your GitHub Pages frontend via URL parameters
            // Your frontend will grab this token out of the URL, save it, and use it
            const frontendUrl = `https://your-username.github.io/your-repo-name/?access_token=${data.access_token}&refresh_token=${data.refresh_token}`;
            res.redirect(frontendUrl);
        } else {
            res.status(response.status).json(data);
        }

    } catch (error) {
        res.status(500).json({ error: 'Failed to authenticate with Spotify' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
