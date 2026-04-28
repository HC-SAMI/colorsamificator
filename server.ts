import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/csv-files', async (req, res) => {
    try {
      const files = fs.existsSync(path.join(process.cwd(), 'data')) ? await fs.readdir(path.join(process.cwd(), 'data')) : await fs.readdir(process.cwd());
      const csvFiles = files.filter(f => f.endsWith('.csv'));
      res.json(csvFiles);
    } catch {
      res.status(500).json({ error: 'Failed to list CSV files' });
    }
  });

  app.get('/api/csv/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      let filePath = path.join(process.cwd(), 'data', filename);
      if (!fs.existsSync(filePath)) filePath = path.join(process.cwd(), filename);
      if (!filePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      res.json(records);
    } catch {
      res.status(500).json({ error: 'Failed to read CSV file' });
    }
  });

  app.post('/api/csv/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const { data } = req.body; // Array of objects
      let filePath = path.join(process.cwd(), 'data', filename);
      if (!fs.existsSync(path.join(process.cwd(), 'data'))) await fs.mkdir(path.join(process.cwd(), 'data'));
      
      if (!filePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Data must be an array' });
      }

      const csvContent = stringify(data, {
        header: true,
      });

      await fs.writeFile(filePath, csvContent);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save CSV file' });
    }
  });

  app.delete('/api/csv/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      let filePath = path.join(process.cwd(), 'data', filename);
      if (!fs.existsSync(filePath)) filePath = path.join(process.cwd(), filename);
      
      if (!filePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (fs.existsSync(filePath)) {
        await fs.unlink(filePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete CSV file' });
    }
  });

  // Static file serving for development
  if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(process.cwd()));
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
