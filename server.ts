import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchOnlineStudioTemplates, type StudioKind } from './server/studioTemplates.ts';
import {
  searchOnlineCreativeAssets,
  proxySafeAssetImage,
  proxySafeMediaAsset,
  type CreativeAssetType,
} from './server/studioAssets.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/studios/templates/search', async (req, res) => {
    try {
      const studioType = (req.body?.studioType || 'design') as StudioKind;
      const query = typeof req.body?.query === 'string' ? req.body.query : '';
      const category = typeof req.body?.category === 'string' ? req.body.category : undefined;
      const lang = req.body?.lang === 'en' ? 'en' : 'fr';
      const page = Number(req.body?.page) || 1;
      const excludeTitles = Array.isArray(req.body?.excludeTitles) ? req.body.excludeTitles : [];
      const result = await searchOnlineStudioTemplates({
        studioType,
        query,
        category,
        lang,
        page,
        excludeTitles,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({
        ok: false,
        templates: [],
        error: err instanceof Error ? err.message : 'Erreur recherche modèles en ligne',
      });
    }
  });

  app.post('/api/studios/assets/search', async (req, res) => {
    try {
      const assetTypeRaw = req.body?.assetType;
      const assetType: CreativeAssetType =
        assetTypeRaw === 'elements' || assetTypeRaw === 'backgrounds' ? assetTypeRaw : 'images';
      const query = typeof req.body?.query === 'string' ? req.body.query : '';
      const page = Number(req.body?.page) || 1;
      const lang = req.body?.lang === 'en' ? 'en' : 'fr';
      const result = await searchOnlineCreativeAssets({ assetType, query, page, lang });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({
        ok: false,
        assets: [],
        hasMore: false,
        error: err instanceof Error ? err.message : 'Erreur recherche ressources en ligne',
      });
    }
  });

  app.get('/api/studios/assets/image-proxy', async (req, res) => {
    try {
      const url = typeof req.query?.url === 'string' ? req.query.url : '';
      if (!url) {
        res.status(400).json({ ok: false, error: 'Paramètre url manquant' });
        return;
      }
      const { buffer, contentType } = await proxySafeAssetImage(url);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Impossible de charger l’image distante',
      });
    }
  });

  app.get('/api/studios/assets/media-proxy', async (req, res) => {
    try {
      const url = typeof req.query?.url === 'string' ? req.query.url : '';
      if (!url) {
        res.status(400).json({ ok: false, error: 'Paramètre url manquant' });
        return;
      }
      const { buffer, contentType } = await proxySafeMediaAsset(url, 'any');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Impossible de charger le média distant',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHALOM server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SHALOM server:', err);
  process.exit(1);
});
