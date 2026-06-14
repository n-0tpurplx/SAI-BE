import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  })
);

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

/* ---------------- MEMORY STORE ---------------- */
let latestSession = null;

/* ---------------- LOGIN ---------------- */
app.get("/login", (req, res) => {
  const scope =
    "user-read-private user-read-email user-top-read playlist-modify-public playlist-modify-private";

  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope,
      redirect_uri: REDIRECT_URI,
    });

  res.redirect(authUrl);
});

/* ---------------- CALLBACK (NO URL RETURN) ---------------- */
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    latestSession = {
      access_token: tokenRes.data.access_token,
      refresh_token: tokenRes.data.refresh_token,
      time: Date.now(),
    };

    // 🔥 ALWAYS return to clean GitHub Pages root
    res.redirect(process.env.FRONTEND_URL);

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).send("Auth failed");
  }
});

/* ---------------- GET CURRENT SESSION ---------------- */
app.get("/session", (req, res) => {
  if (!latestSession) {
    return res.status(404).json({ error: "No session" });
  }

  res.json(latestSession);
});

/* ---------------- SEARCH ---------------- */
app.get("/search", async (req, res) => {
  const token = req.headers.authorization;
  const q = req.query.q;

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`,
      {
        headers: { Authorization: token },
      }
    );

    res.json(response.data);
  } catch {
    res.status(500).send("Search failed");
  }
});

/* ---------------- CREATE PLAYLIST ---------------- */
app.post("/create-playlist", async (req, res) => {
  const token = req.headers.authorization;
  const { tracks } = req.body;

  try {
    const me = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: token },
    });

    const playlist = await axios.post(
      `https://api.spotify.com/v1/users/${me.data.id}/playlists`,
      { name: "Songify Playlist 🎧" },
      { headers: { Authorization: token } }
    );

    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlist.data.id}/tracks`,
      { uris: tracks },
      { headers: { Authorization: token } }
    );

    res.json({
      external_url: playlist.data.external_urls.spotify,
    });

  } catch {
    res.status(500).send("Playlist failed");
  }
});

app.listen(3000, () => console.log("Running"));
