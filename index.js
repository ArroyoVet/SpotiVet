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

app.get('/audio/:videoId', async (req, res) => {
    const trackUrl = req.params.videoId; 
    console.log(`[AUDIO] Generando streaming para: ${trackUrl}`);

    try {
        // Usamos getInfo para obtener todos los metadatos y protocolos de streaming
        const info = await scdl.getInfo(trackUrl);
        
        // Buscamos el formato mp3 en la lista de transcodings
        const mp3Format = info.media.transcodings.find(t => t.format.mime_type === 'audio/mpeg');
        
        if (mp3Format) {
            // Obtenemos la URL final desde el protocolo de SoundCloud
            const streamUrl = await scdl.getStreamUrl(trackUrl); 
            console.log("[AUDIO] ¡Éxito! URL de SoundCloud obtenida.");
            return res.json({ url: streamUrl });
        } else {
            // Si no hay mp3, intentamos el método directo por defecto
            const fallbackUrl = await scdl.getStreamUrl(trackUrl);
            return res.json({ url: fallbackUrl });
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