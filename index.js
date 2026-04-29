const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const scdl = require('soundcloud-downloader').default;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 1. BUSCAR CANCIÓN (Ahora busca en SoundCloud)
app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        console.log(`[BUSQUEDA] Buscando en SoundCloud: ${q}`);
        
        const results = await scdl.search({
            query: q,
            resourceType: 'tracks',
            limit: 10
        });

        if (!results.collection) return res.json([]);

        const songs = results.collection.map(item => ({
            id: item.permalink_url, // Usamos la URL como ID para SoundCloud
            title: item.title,
            artist: item.user.username || 'Artista Independiente',
            duration: msToTime(item.duration),
            thumbnail: item.artwork_url || item.user.avatar_url
        }));

        res.json(songs);
    } catch (err) {
        console.error('[ERROR-SEARCH]', err.message);
        res.status(500).json({ error: 'Error buscando en SoundCloud' });
    }
});

// 2. OBTENER AUDIO (Streaming directo de SoundCloud)
app.get('/audio/:videoId', async (req, res) => {
    // El videoId ahora es la URL de SoundCloud que enviamos en el search
    const trackUrl = req.params.videoId; 
    console.log(`[AUDIO] Generando streaming para: ${trackUrl}`);

    try {
        const streamUrls = await scdl.getStreamingUrls(trackUrl);
        
        // Intentamos obtener el formato mp3 progresivo (el más estable para Android)
        const finalUrl = streamUrls.http_mp3_128_url || streamUrls.hls_mp3_128_url || streamUrls.hls_opus_64_url;

        if (finalUrl) {
            console.log("[AUDIO] ¡Éxito! URL de streaming enviada.");
            return res.json({ url: finalUrl });
        } else {
            throw new Error("No se encontró un formato de audio compatible");
        }
    } catch (error) {
        console.error(`[AUDIO-ERROR] SoundCloud falló: ${error.message}`);
        return res.status(500).json({ error: 'No se pudo obtener el audio' });
    }
});

// 3. OBTENER LETRA (Se mantiene igual, es independiente)
app.get('/lyrics', async (req, res) => {
    try {
        let { title, artist } = req.query;
        title = title.replace(/\(.*?\)|\[.*?\]|official|video|musical|lyrics|ft\.|feat\./gi, '').trim();
        const response = await axios.get('https://lrclib.net/api/search', {
            params: { q: `${title} ${artist}` }
        });
        const match = response.data[0];
        if (!match) return res.status(404).json({ error: 'Letra no encontrada' });
        res.json({ lyrics: match.syncedLyrics || match.plainLyrics });
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo letra' });
    }
});

// 4. OBTENER COVER (Se mantiene igual, busca en iTunes)
app.get('/cover', async (req, res) => {
    try {
        const { title, artist } = req.query;
        const response = await axios.get('https://itunes.apple.com/search', {
            params: { term: `${artist} ${title}`, media: 'music', limit: 1 }
        });
        const result = response.data.results[0];
        if (!result) return res.status(404).json({ error: 'Cover no encontrado' });
        res.json({ cover: result.artworkUrl100.replace('100x100', '600x600') });
    } catch (err) {
        res.status(500).json({ error: 'Error obteniendo cover' });
    }
});

// Función auxiliar para convertir milisegundos a formato MM:SS
function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    return minutes + ":" + (seconds < 10 ? "0" + seconds : seconds);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SpotiVet Backend corriendo en el puerto ${PORT}`);
});