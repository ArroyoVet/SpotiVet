const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const cookiesPath = path.join(__dirname, 'cookies_temp.txt');
if (process.env.COOKIES_CONTENT) {
  fs.writeFileSync(cookiesPath, process.env.COOKIES_CONTENT);
  console.log('Cookies escritas correctamente');
  console.log('Primera línea cookies:', process.env.COOKIES_CONTENT.split('\n')[0]);
  console.log('Total líneas:', process.env.COOKIES_CONTENT.split('\n').length);
}

// Descargar binario al arrancar
const ytDlpPath = path.join(__dirname, 'yt-dlp');
YTDlpWrap.downloadFromGithub(ytDlpPath)
  .then(() => console.log('yt-dlp descargado correctamente'))
  .catch(err => console.error('Error descargando yt-dlp:', err));

const ytDlp = new YTDlpWrap(ytDlpPath);

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

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.privacy.com.de',
  'https://api.piped.yt',
  'https://pipedapi.drgns.space',
  'https://pipedapi.darkness.services',
];

app.get('/audio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await axios.get(`${instance}/streams/${videoId}`, { timeout: 8000 });
      const streams = response.data.audioStreams;
      if (!streams || streams.length === 0) continue;
      const best = streams.find(s => s.mimeType?.includes('m4a')) || streams[0];
      if (best?.url) return res.json({ url: best.url });
    } catch (_) {
      continue;
    }
  }
  
  res.status(500).json({ error: 'No se pudo obtener audio de ninguna instancia' });
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