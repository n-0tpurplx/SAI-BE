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

/* -----------------------------
   HEALTH CHECK
------------------------------*/
app.get("/", (req, res) => {
  res.send("🎧 Songify backend is alive");
});

/* -----------------------------
   STEP 1: LOGIN
------------------------------*/
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
    }).toString();

  res.redirect(authUrl);
});

/* -----------------------------
   STEP 2: CALLBACK
------------------------------*/
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send("No code provided");

  try {
    const tokenResponse = await axios.post(
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

    const { access_token, refresh_token } = tokenResponse.data;

    // For now we just return tokens (frontend will store them)
    res.json({
      access_token,
      refresh_token,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Token exchange failed");
  }
});

/* -----------------------------
   STEP 3: REFRESH TOKEN
------------------------------*/
app.get("/refresh", async (req, res) => {
  const refresh_token = req.query.refresh_token;

  if (!refresh_token) {
    return res.status(400).send("No refresh token");
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Refresh failed");
  }
});

/* -----------------------------
   STEP 4: GET USER PROFILE
------------------------------*/
app.get("/me", async (req, res) => {
  const token = req.headers.authorization;

  if (!token) return res.status(401).send("No token");

  try {
    const response = await axios.get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: token,
      },
    });

    res.json(response.data);
  } catch (err) {
    res.status(500).send("Failed to fetch profile");
  }
});

/* -----------------------------
   START SERVER
------------------------------*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎧 Songify backend running on port ${PORT}`);
});
