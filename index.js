const express = require('express');
const axios = require('axios');
const cors = require('cors');
const YouTubeSearchApi = require('youtube-search-api');

const app = express();
app.use(cors());
app.use(express.json());

// Lista de servidores Piped alternativos para evitar el error 502
const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.smnz.de',
    'https://api.piped.projectsegfau.lt',
    'https://piped-api.lunar.icu'
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

// 2. GENERADOR DE STREAMING (Auto-Fallback de alta resistencia)
app.get('/audio/:videoId', async (req, res) => {
    const { videoId } = req.params;
    console.log(`[AUDIO] Obteniendo stream para: ${videoId}`);

    // Intentamos extraer el audio rotando por los servidores disponibles
    for (const instance of PIPED_INSTANCES) {
        try {
            console.log(`[AUDIO] Probando servidor: ${instance}`);
            // Le damos 4 segundos máximo a cada servidor para responder
            const response = await axios.get(`${instance}/streams/${videoId}`, { timeout: 4000 });
            
            if (response.data && response.data.audioStreams) {
                const audioStream = response.data.audioStreams.find(s => s.format === 'M4A' || s.extension === 'm4a') || 
                                    response.data.audioStreams[0]; // Si no hay m4a, cogemos el primer audio disponible
                
                if (audioStream && audioStream.url) {
                    console.log(`[AUDIO] ¡Éxito! Enlace obtenido de ${instance}`);
                    return res.json({ url: audioStream.url });
                }
            }
        } catch (error) {
            console.log(`[WARN] El servidor ${instance} falló (${error.message}). Saltando al siguiente...`);
            // El loop continúa silenciosamente hacia el siguiente servidor
        }
    }

    // Si llega hasta aquí, es que TODOS los servidores fallaron
    console.error(`[AUDIO-ERROR] Colapso total de instancias para el ID: ${videoId}`);
    res.status(502).json({ error: 'Los servidores comunitarios están saturados. Intenta en unos segundos.' });
});

// 3. LETRAS SINCRONIZADAS (LrcLib)
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
    console.log(`🚀 SpotiVet Backend v4 (Multi-Instancia) en puerto ${PORT}`);
});