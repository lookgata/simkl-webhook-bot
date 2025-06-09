require('dotenv').config();
const fetch = require('node-fetch');
const cron = require('node-cron');
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('✅ Simkl Webhook Bot is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});


const urls = {
  tv: {
    url: 'https://data.simkl.in/calendar/tv.json',
    webhook: process.env.TV_WEBHOOK_URL
  },
  anime: {
    url: 'https://data.simkl.in/calendar/anime.json',
    webhook: process.env.ANIME_WEBHOOK_URL
  },
  movie: {
    url: 'https://data.simkl.in/calendar/movie_release.json',
    webhook: process.env.MOVIE_WEBHOOK_URL
  }
};

let lastModifiedCache = {};

async function shouldFetch(url, type) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const lastModified = res.headers.get('last-modified');
    if (lastModified !== lastModifiedCache[type]) {
      lastModifiedCache[type] = lastModified;
      return true;
    }
    return false;
  } catch (err) {
    console.error(`HEAD check failed for ${type}:`, err.message);
    return false;
  }
}

async function postToWebhook(data, type, webhookUrl) {
  const todayDate = new Date().toISOString().split('T')[0];

  for (const item of data) {
    const date = item.date?.split('T')[0];
    if (date !== todayDate) continue;

    const airTime = new Date(item.date).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const embed = {
      title: item.title || 'Upcoming',
      description: `Season ${item.episode?.season ?? '-'} Episode ${item.episode?.episode ?? '-'}`,
      url: item.episode?.url || item.url || 'https://simkl.com',
      image: {
        url: item.poster
          ? `https://simkl.in/posters/${item.poster}_m.jpg`
          : ''
      },
      footer: { text: `Category: ${type.toUpperCase()}` },
      fields: [{ name: 'Air Date', value: airTime, inline: true }]
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });

    console.log(`[✅] Sent: ${embed.title}`);
  }
}

async function runAll() {
  for (const [type, info] of Object.entries(urls)) {
    if (await shouldFetch(info.url, type)) {
      const res = await fetch(info.url);
      const json = await res.json();
      await postToWebhook(json, type, info.webhook);
    } else {
      console.log(`[ℹ️] No update for ${type}.`);
    }
  }
}

cron.schedule('0 7 * * *', () => {
  console.log('[🕖] 07:00 Asia/Bangkok triggered');
  runAll();
}, {
  timezone: 'Asia/Bangkok'
});

// Manual trigger (e.g. for Railway deploy)
if (process.env.MANUAL === 'true') runAll();
