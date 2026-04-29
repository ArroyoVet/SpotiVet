const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;

const app = express();
app.use(cors());
app.use(express.json());

// yt-dlp-wrap descarga el binario correcto para el SO automáticamente
const ytDlp = new YTDlpWrap();

// Descargar binario al arrancar si no existe
YTDlpWrap.downloadFromGithub().catch(() => {});

// Buscar canción
app.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    const YouTubeSearchApi = require('youtube-search-api');
    const results = await YouTubeSearchApi.GetListByKeyword(q, false, 5);
    const songs = results.items
      .filter(item => item.type === 'video')
      .map(item => ({
        id: item.id,
        title: item.title,
        artist: item.channelTitle || 'Desconocido',
        duration: item.length?.simpleText || '0:00',
      }));
    res.json(songs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error buscando canción' });
  }
});

// Obtener URL de audio
app.get('/audio/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const stdout = await ytDlp.execPromise([
      url,
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--get-url',
      '--no-playlist',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ]);
    res.json({ url: stdout.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo audio' });
  }
});

// Obtener URL de video
app.get('/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const stdout = await ytDlp.execPromise([
      url,
      '-f', 'best[ext=mp4][height<=720]/best',
      '--get-url',
      '--no-playlist',
    ]);
    res.json({ url: stdout.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo video' });
  }
});

// Obtener letra
app.get('/lyrics', async (req, res) => {
  try {
    let { title, artist } = req.query;
    title = title.replace(/\(.*?\)|\[.*?\]|official|video|musical|lyrics|ft\.|feat\./gi, '').trim();
    artist = artist.replace(/VEVO|Official/gi, '').trim();
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

// Obtener cover
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});