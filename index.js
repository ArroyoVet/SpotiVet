const express = require('express');
const axios = require('axios');
const cors = require('cors');
const YouTubeSearchApi = require('youtube-search-api');

const app = express();
app.use(cors());
app.use(express.json());

// --- RUTA DE INICIO (RESTABLECIDA) ---
app.get('/', (req, res) => {
    res.send(`
        <div style="background-color: #121212; color: white; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="padding: 40px; border-radius: 20px; background-color: #1E1E1E; text-align: center; border: 2px solid #1DB954; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h1 style="color: #1DB954; font-size: 3rem; margin-bottom: 10px;">🐾 SpotiVet</h1>
                <p style="font-size: 1.2rem; color: #B3B3B3;">Servidor de Búsqueda y Letras Sincronizadas</p>
                <div style="margin-top: 30px; display: inline-block; padding: 10px 25px; background-color: #1DB954; color: black; border-radius: 50px; font-weight: bold; letter-spacing: 1px;">
                    STATUS: ONLINE 🚀
                </div>
                <p style="margin-top: 20px; font-size: 0.9rem; color: #555;">Conectado desde la red de SpotiVet App</p>
            </div>
        </div>
    `);
});

// --- BUSCADOR ---
app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        console.log(`[BUSQUEDA] Consultando: ${q}`);
        const results = await YouTubeSearchApi.GetListByKeyword(q, false, 10);
        const songs = results.items
            .filter(item => item.type === 'video')
            .map(item => ({
                id: item.id,
                title: item.title,
                artist: item.channelTitle || 'Artista',
                duration: item.length?.simpleText || '0:00',
                thumbnail: item.thumbnail?.thumbnails[0]?.url || ''
            }));
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: 'Error en el buscador' });
    }
});

// --- LETRAS ---
app.get('/lyrics', async (req, res) => {
    try {
        const { title, artist } = req.query;
        const cleanTitle = title.replace(/\(.*?\)|\[.*?\]|official|video|audio/gi, '').trim();
        const response = await axios.get('https://lrclib.net/api/search', {
            params: { q: `${cleanTitle} ${artist}` }
        });
        const match = response.data[0];
        if (match) {
            res.json({ lyrics: match.syncedLyrics || match.plainLyrics });
        } else {
            res.status(404).json({ error: 'Letra no encontrada' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo letra' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SpotiVet Backend v6 (Hybrid Ready) en puerto ${PORT}`);
});