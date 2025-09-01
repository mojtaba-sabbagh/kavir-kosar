import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ message: 'فایلی ارسال نشده است' }, { status: 400 });

    // ensure folder exists
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const buf = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name || '') || '';
    const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    const name = `${Date.now()}-${hash}${ext}`;
    const dest = path.join(UPLOAD_DIR, name);
    await fs.writeFile(dest, buf);

    const storageKey = `/uploads/${name}`; // public URL under next/public
    return NextResponse.json({
      ok: true,
      storageKey,
      fileName: file.name,
      size: buf.length,
      mimeType: file.type || 'application/octet-stream',
    });
  } catch (e) {
    console.error('upload error:', e);
    return NextResponse.json({ message: 'خطا در بارگذاری فایل' }, { status: 500 });
  }
}
