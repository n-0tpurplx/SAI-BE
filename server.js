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
    credentials: true,
  })
);

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

/* ---------------- MEMORY SESSION STORE ---------------- */
const sessions = new Map();

/* ---------------- HEALTH ---------------- */
app.get("/", (req, res) => {
  res.send("Songify backend alive 🎧");
});

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

/* ---------------- CALLBACK (SESSION FIX) ---------------- */
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

    const { access_token, refresh_token } = tokenRes.data;

    const sessionId = Math.random().toString(36).substring(2);

    sessions.set(sessionId, {
      access_token,
      refresh_token,
    });

    // NO TOKEN IN URL (safe for GitHub Pages)
    res.redirect(`${process.env.FRONTEND_URL}?session=${sessionId}`);
  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).send("Auth failed");
  }
});

/* ---------------- SESSION FETCH ---------------- */
app.get("/session/:id", (req, res) => {
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json(session);
});

/* ---------------- SEARCH ---------------- */
app.get("/search", async (req, res) => {
  const token = req.headers.authorization;
  const q = req.query.q;

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    res.json(response.data);
  } catch (err) {
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

    const userId = me.data.id;

    const playlist = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        name: "Songify Playlist 🎧",
        description: "Created with Songify",
      },
      {
        headers: { Authorization: token },
      }
    );

    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlist.data.id}/tracks`,
      {
        uris: tracks,
      },
      {
        headers: { Authorization: token },
      }
    );

    res.json({
      external_url: playlist.data.external_urls.spotify,
    });
  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).send("Playlist failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on", PORT));
