const express = require('express');
const axios = require('axios');
const cors = require('cors');
const YouTubeSearchApi = require('youtube-search-api');

const app = express();
app.use(cors());
app.use(express.json());

// 1. BUSCADOR UNIVERSAL (YouTube)
// Esto te dará acceso a toda la música comercial, remixes y sonidos para animales.
app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        console.log(`[BUSQUEDA] Consultando: ${q}`);
        
        // Buscamos los primeros 10 resultados
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

// 2. GENERADOR DE STREAMING (Anti-Bloqueo)
// Usamos una instancia pública de Piped como puente para evitar que Render sea bloqueado.
app.get('/audio/:videoId', async (req, res) => {
    const { videoId } = req.params;
    console.log(`[AUDIO] Obteniendo stream para: ${videoId}`);

    try {
        // Consultamos a una instancia de Piped (comunidad de código abierto)
        // Estas instancias rotan IPs y son muy difíciles de bloquear.
        const response = await axios.get(`https://pipedapi.kavin.rocks/streams/${videoId}`);
        
        // Filtramos para obtener solo el audio en formato M4A o MP3
        const audioStream = response.data.audioStreams.find(s => s.format === 'M4A' || s.extension === 'm4a');
        
        if (audioStream && audioStream.url) {
            console.log("[AUDIO] Enlace directo enviado al celular.");
            res.json({ url: audioStream.url });
        } else {
            throw new Error("No se encontró un flujo de audio compatible");
        }
    } catch (error) {
        console.error(`[AUDIO-ERROR] Falló la extracción: ${error.message}`);
        // Intentamos una segunda instancia si la primera falla (Auto-Fallback)
        try {
            const fallback = await axios.get(`https://api.piped.victr.me/streams/${videoId}`);
            const fbStream = fallback.data.audioStreams[0];
            res.json({ url: fbStream.url });
        } catch (e) {
            res.status(500).json({ error: 'La canción no está disponible en esta región' });
        }
    }
});

// 3. LETRAS SINCRONIZADAS (LrcLib)
app.get('/lyrics', async (req, res) => {
    try {
        const { title, artist } = req.query;
        // Limpiamos el título para mejorar la puntería de la letra
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
    console.log(`🚀 SpotiVet Backend v3 (Hybrid YouTube) en puerto ${PORT}`);
});