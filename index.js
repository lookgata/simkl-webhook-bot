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

async function runAll() {
  for (const [type, info] of Object.entries(urls)) {
    if (await shouldFetch(info.url, type)) {
      const res = await fetch(info.url);
      const json = await res.json();
      await postToWebhook(json, type, info.webhook);
    } else {
      console.log(`No update for ${type}.`);
    }
  }
}

const schedules = ['15 4 * * *', '15 10 * * *', '15 16 * * *']; // 11:15, 17:15, 23:15 TH

schedules.forEach(schedule => {
  cron.schedule(schedule, () => {
    console.log(`Running job at ${schedule}`);
    runAll();
  });
});

// run once on start (optional)
// runAll();