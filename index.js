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

// Obtener URL de audio
app.get('/audio/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    const args = [
      url,
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--get-url',
      '--no-playlist',
      '--sleep-requests', '2',
      '--no-warnings',
    ];

    if (fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }

    const stdout = await ytDlp.execPromise(args);
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