import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  getState,
  insertTransactionsBatch,
  patchTransaction,
  deleteTransactionById,
  savePreferences,
  insertDocumentRecord,
  deleteDocumentRecord,
  wipeAllData,
  getDriveSyncInfo,
  getDb
} from './server/db.js';
import {
  saveUploadFile,
  saveDriveFile,
  getFileBuffer,
  deleteFile
} from './server/storage.js';
import { parseDocumentWithAi } from './server/gemini.js';

const upload = multer({
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  storage: multer.memoryStorage()
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', name: 'Ledgerly Server', timestamp: new Date().toISOString() });
  });

  // 1. GET /api/state
  app.get('/api/state', async (req: Request, res: Response) => {
    try {
      const state = await getState();
      res.json(state);
    } catch (err: any) {
      console.error('Error in GET /api/state:', err);
      res.status(500).json({ error: 'Failed to retrieve application state', details: err.message });
    }
  });

  // 2. POST /api/transactions
  app.post('/api/transactions', async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const items = Array.isArray(body) ? body : [body];
      const result = await insertTransactionsBatch(items);
      res.json(result);
    } catch (err: any) {
      console.error('Error in POST /api/transactions:', err);
      res.status(500).json({ error: 'Failed to insert transactions', details: err.message });
    }
  });

  // 3. PATCH /api/transactions/:id & PATCH /api/transactions
  app.patch('/api/transactions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { category, tags } = req.body;
      const updated = await patchTransaction(id, { category, tags });
      if (!updated) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json(updated);
    } catch (err: any) {
      console.error('Error in PATCH /api/transactions/:id:', err);
      res.status(500).json({ error: 'Failed to update transaction', details: err.message });
    }
  });

  app.patch('/api/transactions', async (req: Request, res: Response) => {
    try {
      const { id, category, tags } = req.body;
      if (!id) return res.status(400).json({ error: 'Transaction ID is required' });
      const updated = await patchTransaction(id, { category, tags });
      if (!updated) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      res.json(updated);
    } catch (err: any) {
      console.error('Error in PATCH /api/transactions:', err);
      res.status(500).json({ error: 'Failed to update transaction', details: err.message });
    }
  });

  // 4. DELETE /api/transactions/:id
  app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteTransactionById(id);
      res.json({ success: true, id });
    } catch (err: any) {
      console.error('Error in DELETE /api/transactions/:id:', err);
      res.status(500).json({ error: 'Failed to delete transaction', details: err.message });
    }
  });

  // 5. PUT /api/preferences
  app.put('/api/preferences', async (req: Request, res: Response) => {
    try {
      const prefs = req.body;
      if (!prefs || typeof prefs !== 'object') {
        return res.status(400).json({ error: 'Invalid preferences payload' });
      }
      const result = await savePreferences(prefs);
      res.json(result);
    } catch (err: any) {
      console.error('Error in PUT /api/preferences:', err);
      res.status(500).json({ error: 'Failed to save preferences', details: err.message });
    }
  });

  // 6. POST /api/documents (Multipart upload up to 20MB per file)
  app.post('/api/documents', upload.array('files', 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const results: any[] = [];
      const extractedTransactions: any[] = [];

      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          results.push({
            filename: file.originalname,
            error: 'File exceeds 20MB limit'
          });
          continue;
        }

        // 1. Save original bytes to R2 bucket
        const { objectKey, size } = saveUploadFile(file.originalname, file.buffer);

        // 2. Parse file content for grounded transaction data
        const extracted = await parseDocumentWithAi(file.buffer, file.mimetype, file.originalname);
        const status = extracted.confidence === 'high' ? 'stored' : 'review';

        // 3. Record in D1 documents table
        const docRecord = await insertDocumentRecord({
          filename: file.originalname,
          mimeType: file.mimetype,
          size,
          objectKey,
          status,
          source: 'upload'
        });

        // 4. If grounded transaction extracted with high confidence, optionally create transaction
        if (extracted.merchant && extracted.amount && extracted.date && extracted.confidence === 'high') {
          const txRes = await insertTransactionsBatch([
            {
              date: extracted.date,
              merchant: extracted.merchant,
              category: extracted.category || 'Needs review',
              amount: extracted.amount,
              type: extracted.type || 'expense',
              account: 'Manual upload',
              tags: ['Receipt'],
              receipt: true,
              source: 'document'
            }
          ]);
          if (txRes.transactions.length > 0) {
            extractedTransactions.push(txRes.transactions[0]);
          }
        }

        results.push({
          document: docRecord,
          extracted
        });
      }

      res.json({
        success: true,
        documents: results,
        extractedTransactions
      });
    } catch (err: any) {
      console.error('Error in POST /api/documents:', err);
      res.status(500).json({ error: 'Failed to process document upload', details: err.message });
    }
  });

  // 7. GET /api/documents/:id/download
  app.get('/api/documents/:id/download', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const database = await getDb();
      const stmt = database.prepare('SELECT filename, mimeType, objectKey FROM documents WHERE id = :id');
      stmt.bind({ ':id': id });
      if (!stmt.step()) {
        stmt.free();
        return res.status(404).json({ error: 'Document not found' });
      }
      const { filename, mimeType, objectKey } = stmt.getAsObject() as any;
      stmt.free();

      const buffer = getFileBuffer(objectKey);
      if (!buffer) {
        return res.status(404).json({ error: 'File content not found in storage' });
      }

      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      res.send(buffer);
    } catch (err: any) {
      console.error('Error in GET /api/documents/:id/download:', err);
      res.status(500).json({ error: 'Failed to download document', details: err.message });
    }
  });

  // 8. DELETE /api/documents/:id
  app.delete('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const objectKey = await deleteDocumentRecord(id);
      if (objectKey) {
        deleteFile(objectKey);
      }
      res.json({ success: true, id });
    } catch (err: any) {
      console.error('Error in DELETE /api/documents/:id:', err);
      res.status(500).json({ error: 'Failed to delete document', details: err.message });
    }
  });

  // 9. DELETE /api/state (Data wipe with confirmation)
  app.delete('/api/state', async (req: Request, res: Response) => {
    try {
      const { confirmation } = req.body;
      if (confirmation !== 'DELETE ALL LEDGERLY DATA') {
        return res.status(400).json({
          error: 'Invalid confirmation string. Expected: "DELETE ALL LEDGERLY DATA"'
        });
      }

      const result = await wipeAllData();
      res.json(result);
    } catch (err: any) {
      console.error('Error in DELETE /api/state:', err);
      res.status(500).json({ error: 'Failed to wipe state', details: err.message });
    }
  });

  // 10. GET /api/drive-sync
  app.get('/api/drive-sync', async (req: Request, res: Response) => {
    try {
      const info = await getDriveSyncInfo();
      res.json(info);
    } catch (err: any) {
      console.error('Error in GET /api/drive-sync:', err);
      res.status(500).json({ error: 'Failed to get drive sync info', details: err.message });
    }
  });

  // 11. POST /api/drive-sync
  app.post('/api/drive-sync', async (req: Request, res: Response) => {
    try {
      const { files = [], transactions = [], errors = [] } = req.body;
      const database = await getDb();

      let storedFilesCount = 0;
      let reviewFilesCount = 0;
      const processedIds: string[] = [];
      const newDocuments: any[] = [];

      // Process and store Drive files
      for (const f of files) {
        try {
          const { fileId, filename, mimeType, contentBase64, status = 'stored' } = f;
          if (!fileId || !filename) continue;

          let finalObjectKey = `drive-inbox/${fileId}-${filename}`;
          let fileSize = 0;

          if (contentBase64) {
            const buffer = Buffer.from(contentBase64, 'base64');
            fileSize = buffer.length;
            const saved = saveDriveFile(fileId, filename, buffer);
            finalObjectKey = saved.objectKey;
          }

          const docStatus = status === 'review' ? 'review' : 'stored';
          if (docStatus === 'review') reviewFilesCount++;
          else storedFilesCount++;

          const docRecord = await insertDocumentRecord({
            filename,
            mimeType: mimeType || 'application/octet-stream',
            size: fileSize,
            objectKey: finalObjectKey,
            status: docStatus,
            source: 'google-drive'
          });

          newDocuments.push(docRecord);
          processedIds.push(fileId);
        } catch (fileErr: any) {
          console.error('Error processing drive file:', fileErr);
          errors.push(`File error (${f.filename || f.fileId}): ${fileErr.message}`);
        }
      }

      // Process grounded Drive transactions with duplicate detector
      const txInputList = transactions.map((t: any) => ({
        date: t.date,
        merchant: t.merchant,
        amount: Math.abs(Number(t.amount)),
        type: t.type === 'income' ? 'income' : 'expense',
        account: t.account || 'Drive import',
        category: t.category || 'Needs review',
        tags: Array.from(new Set([...(t.tags || []), 'Drive import'])),
        receipt: t.receipt ? true : false,
        source: 'google-drive'
      }));

      const txResult = await insertTransactionsBatch(txInputList);

      // Update processedFileIds and sync status in settings
      const syncInfo = await getDriveSyncInfo();
      const existingFileIds = new Set(syncInfo.processedFileIds);
      for (const id of processedIds) {
        existingFileIds.add(id);
      }
      const updatedProcessedList = Array.from(existingFileIds).slice(-5000);

      const now = new Date().toISOString();
      const newSyncStats = {
        lastSyncedAt: now,
        status: errors.length > 0 ? 'partial' : 'complete',
        imported: txResult.inserted,
        duplicates: txResult.duplicates,
        stored: storedFilesCount,
        review: reviewFilesCount,
        errors
      };

      await savePreferences({
        processedFileIds: updatedProcessedList,
        driveSync: newSyncStats
      });

      res.json({
        status: newSyncStats.status,
        lastSyncedAt: now,
        imported: txResult.inserted,
        duplicates: txResult.duplicates,
        storedFiles: storedFilesCount,
        reviewFiles: reviewFilesCount,
        errors,
        transactions: txResult.transactions,
        documents: newDocuments
      });
    } catch (err: any) {
      console.error('Error in POST /api/drive-sync:', err);
      res.status(500).json({ error: 'Drive sync failed', details: err.message });
    }
  });

  // 12. POST /api/drive/config
  app.post('/api/drive/config', async (req: Request, res: Response) => {
    try {
      const { folderId, folderName, folderUrl } = req.body;
      const folderData = {
        name: folderName || 'Ledgerly Financial Inbox',
        id: folderId || '',
        url: folderUrl || (folderId ? `https://drive.google.com/drive/folders/${folderId}` : '')
      };
      await savePreferences({ driveFolder: folderData });
      res.json({ success: true, folder: folderData });
    } catch (err: any) {
      console.error('Error in POST /api/drive/config:', err);
      res.status(500).json({ error: 'Failed to update Drive config', details: err.message });
    }
  });

  // Vite middleware for dev / static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ledgerly server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting Ledgerly server:', err);
});
