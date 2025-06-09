require('dotenv').config();
const fetch = require('node-fetch');
const cron = require('node-cron');

const urls = {
  tv: { url: 'https://data.simkl.in/calendar/tv.json', webhook: process.env.TV_WEBHOOK_URL },
  anime: { url: 'https://data.simkl.in/calendar/anime.json', webhook: process.env.ANIME_WEBHOOK_URL },
  movie: { url: 'https://data.simkl.in/calendar/movie_release.json', webhook: process.env.MOVIE_WEBHOOK_URL }
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
    console.error(`Error checking HEAD for ${type}:`, err.message);
    return false;
  }
}

async function postToWebhook(data, type, webhookUrl) {
  const today = new Date().toISOString().split('T')[0];

  for (const item of data) {
    const airDate = item.air_date?.split('T')[0];
    if (airDate >= today) {
      const embed = {
        title: item.show?.title || item.title || 'Upcoming',
        description: item.episode_title || 'New release',
        image: { url: item.images?.poster || item.images?.fanart || '' },
        footer: { text: `Category: ${type.toUpperCase()}` },
        url: item.show?.url || 'https://simkl.com',
        fields: [{ name: 'Air Date', value: airDate, inline: true }]
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    }
  }
}

