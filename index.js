const express = require('express');
const axios = require('axios');
const cors = require('cors');
const YouTubeSearchApi = require('youtube-search-api');

const app = express();
app.use(cors());
app.use(express.json());

// Combinamos las mejores instancias de Piped Y de Invidious
const YT_APIS = [
    // --- Servidores Invidious (Súper estables para audio) ---
    { url: 'https://invidious.nerdvpn.de/api/v1/videos/', type: 'invidious' },
    { url: 'https://inv.tux.pizza/api/v1/videos/', type: 'invidious' },
    { url: 'https://invidious.asir.dev/api/v1/videos/', type: 'invidious' },
    // --- Servidores Piped (De respaldo) ---
    { url: 'https://pipedapi.kavin.rocks/streams/', type: 'piped' },
    { url: 'https://pipedapi.tokhmi.xyz/streams/', type: 'piped' }
];

// 1. BUSCADOR UNIVERSAL (YouTube)
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
        console.error('[ERROR-SEARCH]', err.message);
        res.status(500).json({ error: 'Error en el buscador' });
    }
});

// 2. GENERADOR DE STREAMING (Motor Híbrido Invidious + Piped)
app.get('/audio/:videoId', async (req, res) => {
    const { videoId } = req.params;
    console.log(`\n[AUDIO] Buscando stream para ID: ${videoId}`);

    for (const api of YT_APIS) {
        try {
            console.log(`[AUDIO] Intentando con: ${api.url}`);
            
            // Subimos el timeout a 10 segundos (10000ms). ¡La paciencia es clave aquí!
            const response = await axios.get(`${api.url}${videoId}`, { timeout: 10000 });
            
            // Lógica si el servidor que respondió es Invidious
            if (api.type === 'invidious' && response.data?.adaptiveFormats) {
                // Buscamos formato mp4 audio o webm audio
                const stream = response.data.adaptiveFormats.find(f => f.type.includes('audio/mp4') || f.type.includes('audio/webm'));
                if (stream?.url) {
                    console.log(`[AUDIO] ✅ ¡Éxito con Invidious!`);
                    return res.json({ url: stream.url });
                }
            }
            // Lógica si el servidor que respondió es Piped
            else if (api.type === 'piped' && response.data?.audioStreams) {
                const stream = response.data.audioStreams.find(s => s.format === 'M4A' || s.extension === 'm4a') || response.data.audioStreams[0];
                if (stream?.url) {
                    console.log(`[AUDIO] ✅ ¡Éxito con Piped!`);
                    return res.json({ url: stream.url });
                }
            }
        } catch (error) {
            // Imprimimos el error limpio para no saturar los logs
            console.log(`[WARN] ❌ Falló (${error.message}) - Saltando al siguiente...`);
        }
    }

    console.error(`[AUDIO-ERROR] Colapso total. Ningún motor pudo descifrar el ID: ${videoId}`);
    res.status(502).json({ error: 'Servidores comunitarios saturados.' });
});

// 3. LETRAS SINCRONIZADAS
app.get('/lyrics', async (req, res) => {
    try {
        const { title, artist } = req.query;
        const cleanTitle = title.replace(/\(.*?\)|\[.*?\]|official|video/gi, '').trim();
        
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
    console.log(`🚀 SpotiVet Backend v5 (Híbrido Invidious/Piped) en puerto ${PORT}`);
});