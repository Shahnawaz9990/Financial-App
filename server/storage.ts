import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const BUCKET_DIR = path.join(DATA_DIR, 'r2_bucket');
const UPLOADS_DIR = path.join(BUCKET_DIR, 'uploads');
const DRIVE_INBOX_DIR = path.join(BUCKET_DIR, 'drive-inbox');

// Ensure directories exist
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BUCKET_DIR)) fs.mkdirSync(BUCKET_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DRIVE_INBOX_DIR)) fs.mkdirSync(DRIVE_INBOX_DIR, { recursive: true });
}

ensureDirs();

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function saveUploadFile(originalFilename: string, buffer: Buffer): { objectKey: string; size: number } {
  ensureDirs();
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of 20MB (got ${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`);
  }
  const uuid = crypto.randomUUID();
  const safeName = sanitizeFilename(originalFilename);
  const objectKey = `uploads/${uuid}-${safeName}`;
  const filePath = path.join(BUCKET_DIR, objectKey);
  
  // Ensure subfolder
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
  
  fs.writeFileSync(filePath, buffer);
  return { objectKey, size: buffer.length };
}

export function saveDriveFile(driveFileId: string, originalFilename: string, buffer: Buffer): { objectKey: string; size: number } {
  ensureDirs();
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Drive file exceeds maximum size of 20MB (got ${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`);
  }
  const safeFileId = sanitizeFilename(driveFileId);
  const safeName = sanitizeFilename(originalFilename);
  const objectKey = `drive-inbox/${safeFileId}-${safeName}`;
  const filePath = path.join(BUCKET_DIR, objectKey);
  
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
  
  fs.writeFileSync(filePath, buffer);
  return { objectKey, size: buffer.length };
}

export function getFileBuffer(objectKey: string): Buffer | null {
  const filePath = path.join(BUCKET_DIR, objectKey);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function deleteFile(objectKey: string): boolean {
  try {
    const filePath = path.join(BUCKET_DIR, objectKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to delete file from R2 bucket:', err);
    return false;
  }
}

export function wipeAllBucketObjects(): void {
  try {
    if (fs.existsSync(BUCKET_DIR)) {
      fs.rmSync(BUCKET_DIR, { recursive: true, force: true });
    }
    ensureDirs();
  } catch (err) {
    console.error('Failed to wipe R2 bucket objects:', err);
  }
}
