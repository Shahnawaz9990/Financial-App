import { getCachedToken, signInWithGoogle } from './firebase';
import { postDriveSyncBatch, updateDriveConfig, getDriveSyncMeta } from './api';

export interface DriveFolderMatch {
  id: string;
  name: string;
  webViewLink?: string;
}

export async function ensureDriveAuthToken(): Promise<string> {
  const currentToken = getCachedToken();
  if (currentToken) return currentToken;
  const res = await signInWithGoogle();
  return res.token;
}

export async function findOrCreateLedgerlyFolder(token: string): Promise<DriveFolderMatch> {
  // Search for folder named exactly "Ledgerly Financial Inbox"
  const q = "name = 'Ledgerly Financial Inbox' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;

  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Google Drive API error: ${res.statusText}`);
  }

  const data = await res.json();
  const files: DriveFolderMatch[] = data.files || [];

  if (files.length > 0) {
    // Reuse existing folder
    const folder = files[0];
    await updateDriveConfig(folder.id, folder.name, folder.webViewLink);
    return folder;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Ledgerly Financial Inbox',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
  }

  const newFolder = await createRes.json();
  const folderInfo: DriveFolderMatch = {
    id: newFolder.id,
    name: 'Ledgerly Financial Inbox',
    webViewLink: `https://drive.google.com/drive/folders/${newFolder.id}`
  };

  await updateDriveConfig(folderInfo.id, folderInfo.name, folderInfo.webViewLink);
  return folderInfo;
}

export async function syncDriveInbox(
  onProgress?: (status: string) => void,
  explicitToken?: string,
  explicitFolderId?: string
): Promise<{
  filesScanned: number;
  insertedCount: number;
  duplicateCount: number;
  storedFiles: number;
  reviewFiles: number;
  errors: string[];
}> {
  onProgress?.('Authenticating with Google Drive...');
  const token = explicitToken || (await ensureDriveAuthToken());

  onProgress?.('Locating Ledgerly Financial Inbox...');
  let folderId = explicitFolderId;
  let resetAt: string | null = null;
  let processedFileIds: string[] = [];

  try {
    const meta = await getDriveSyncMeta();
    if (!folderId) {
      folderId = meta.folder?.id;
    }
    resetAt = meta.driveResetAt || null;
    processedFileIds = meta.processedFileIds || [];
  } catch (e) {
    console.warn('Could not fetch remote drive meta, creating folder directly:', e);
  }

  if (!folderId) {
    const folder = await findOrCreateLedgerlyFolder(token);
    folderId = folder.id;
  }

  const processedSet = new Set(processedFileIds);
  const resetTime = resetAt ? new Date(resetAt).getTime() : 0;

  onProgress?.('Scanning inbox for new receipts and statements...');
  // List direct children of folder
  const q = `'${folderId}' in parents and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=100`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!listRes.ok) {
    throw new Error(`Failed to list Drive folder: ${listRes.statusText}`);
  }

  const listData = await listRes.json();
  const files = listData.files || [];

  const filesToProcess: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (processedSet.has(file.id)) continue;
    if (file.mimeType === 'application/vnd.google-apps.folder') continue;

    const modTime = file.modifiedTime ? new Date(file.modifiedTime).getTime() : Date.now();
    if (resetTime && modTime <= resetTime) {
      continue; // Skip files modified at or before reset
    }

    try {
      onProgress?.(`Downloading file ${i + 1}/${files.length}: ${file.name}...`);
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const dlRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!dlRes.ok) {
        errors.push(`Failed to download ${file.name}: ${dlRes.statusText}`);
        continue;
      }

      const arrayBuffer = await dlRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let j = 0; j < bytes.byteLength; j++) {
        binary += String.fromCharCode(bytes[j]);
      }
      const base64 = btoa(binary);

      filesToProcess.push({
        fileId: file.id,
        filename: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        contentBase64: base64,
        status: 'stored'
      });
    } catch (err: any) {
      errors.push(`Error reading ${file.name}: ${err.message}`);
    }
  }

  if (filesToProcess.length === 0 && errors.length === 0) {
    onProgress?.('Inbox up to date (no new files).');
    return {
      filesScanned: files.length,
      insertedCount: 0,
      duplicateCount: 0,
      storedFiles: 0,
      reviewFiles: 0,
      errors: []
    };
  }

  onProgress?.(`Processing and parsing ${filesToProcess.length} document(s) with Gemini AI...`);
  const result = await postDriveSyncBatch({
    files: filesToProcess,
    transactions: [],
    errors
  });

  onProgress?.('Sync complete!');
  return {
    filesScanned: files.length,
    insertedCount: result.imported || 0,
    duplicateCount: result.duplicates || 0,
    storedFiles: result.storedFiles || filesToProcess.length,
    reviewFiles: result.reviewFiles || 0,
    errors: result.errors || errors
  };
}
