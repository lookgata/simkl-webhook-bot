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
  const now = new Date();

  // กำหนดช่วงเวลาที่ต้องการ (5:30 วันนี้ - 5:30 วันพรุ่งนี้)
  const start = new Date(now);
  start.setHours(5, 30, 0, 0);  // วันนี้ 05:30

  if (now < start) {
    // ถ้าตอนนี้ก่อน 5:30 ให้ใช้ start เป็น 5:30 ของวันก่อนหน้า
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1); // 5:30 ของวันถัดไป

  for (const item of data) {
    // แปลง item.date (UTC) -> Date object
    const itemDateUTC = new Date(item.date);

    // แปลงเป็นเวลาประเทศไทย (+7 ชม.)
    const itemDateTH = new Date(itemDateUTC.getTime() + 7 * 60 * 60 * 1000);

    // เช็คว่าอยู่ในช่วง 5:30 วันนี้ ถึง 5:30 วันถัดไปหรือไม่
    if (itemDateTH >= start && itemDateTH < end) {
      const airTime = itemDateTH.toLocaleString('th-TH', {
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

cron.schedule('0 6 * * *', () => {
  console.log('[🕠] 05:30 Asia/Bangkok triggered');
  runAll();
}, {
  timezone: 'Asia/Bangkok'
});

// Manual trigger (e.g. for Railway deploy)
if (process.env.MANUAL === 'true') runAll();
