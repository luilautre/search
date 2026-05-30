import { Router } from "express";

const router = Router();

interface SteamApp {
  appid: number;
  name: string;
  img: string;
  price: string;
}

function parseSuggestHtml(html: string): SteamApp[] {
  const results: SteamApp[] = [];
  const anchorRe = /data-ds-appid="(\d+)"[\s\S]*?<div class="match_name[^"]*">([\s\S]*?)<\/div>[\s\S]*?<img src="([^"]*)"[\s\S]*?<div class="match_subtitle">([\s\S]*?)<\/div>/g;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    results.push({
      appid: parseInt(m[1], 10),
      name: m[2].trim(),
      img: m[3].trim(),
      price: m[4].trim(),
    });
  }
  return results;
}

router.get("/steam/search", async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit ?? 10), 20);

  if (!query) {
    res.status(400).json({ error: "Missing query parameter `q`" });
    return;
  }

  try {
    const url = `https://store.steampowered.com/search/suggest?term=${encodeURIComponent(query)}&f=games&cc=US&l=english&use_store_query=1&use_search_suggest_min=0&count=${limit}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SteamLauncher/1.0)" },
    });

    if (!response.ok) {
      res.status(502).json({ error: `Steam returned ${response.status}` });
      return;
    }

    const html = await response.text();
    const results = parseSuggestHtml(html);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Steam search failed");
    res.status(502).json({ error: "Failed to reach Steam" });
  }
});

export default router;
