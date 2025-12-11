import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { requireAdminOrRedirect } from '@/lib/rbac';
import { prisma } from '@/lib/db';

// Try to find pg_dump or tar command
function findCommand(cmd: string): string {
  const commonPaths = [
    // Standard Unix paths (Linux/Ubuntu)
    `/usr/bin/${cmd}`,
    `/usr/local/bin/${cmd}`,
    
    // macOS Homebrew paths
    `/opt/homebrew/bin/${cmd}`,
    `/usr/local/opt/${cmd.startsWith('pg_') ? 'libpq' : cmd}/bin/${cmd}`,
    
    // Homebrew on Intel Macs - libpq versions
    `/usr/local/Cellar/libpq/*/bin/${cmd}`,
    
    // Direct glob pattern search (for libpq versions)
    ...(cmd === 'pg_dump' ? getLibpqPaths() : []),
    
    // Fallback to command in PATH
    cmd,
  ];

  for (const cmdPath of commonPaths) {
    try {
      // Skip glob patterns for direct access
      if (cmdPath.includes('*')) continue;
      
      fs.accessSync(cmdPath, fs.constants.X_OK);
      return cmdPath;
    } catch {
      // Continue to next path
    }
  }

  return cmd;
}

function getLibpqPaths(): string[] {
  const paths: string[] = [];
  
  try {
    // Check /usr/local/Cellar/libpq for any version
    const cellarPath = '/usr/local/Cellar/libpq';
    if (fs.existsSync(cellarPath)) {
      const versions = fs.readdirSync(cellarPath);
      for (const version of versions) {
        const pgDumpPath = path.join(cellarPath, version, 'bin', 'pg_dump');
        if (fs.existsSync(pgDumpPath)) {
          paths.push(pgDumpPath);
        }
      }
    }
  } catch (err) {
    // Silently continue if directory doesn't exist
  }

  try {
    // Check /opt/homebrew/Cellar/libpq for any version
    const cellarPath = '/opt/homebrew/Cellar/libpq';
    if (fs.existsSync(cellarPath)) {
      const versions = fs.readdirSync(cellarPath);
      for (const version of versions) {
        const pgDumpPath = path.join(cellarPath, version, 'bin', 'pg_dump');
        if (fs.existsSync(pgDumpPath)) {
          paths.push(pgDumpPath);
        }
      }
    }
  } catch (err) {
    // Silently continue if directory doesn't exist
  }

  return paths;
}

function parseConnectionString(connString: string) {
  const url = new URL(connString);
  return {
    user: url.username,
    password: url.password,
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace('/', ''),
  };
}

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;

  try {
    // Check admin permission
    await requireAdminOrRedirect('/api/admin/backup');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { message: 'DATABASE_URL not configured' },
        { status: 500 }
      );
    }

    // Create temporary directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-'));
    const dbBackupFile = path.join(tmpDir, 'database.sql');
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const uploadsBackupDir = path.join(tmpDir, 'uploads');
    const finalBackupFile = path.join(tmpDir, `backup.tar.gz`);

    console.log('Starting backup process...');

    // 1. Backup database
    console.log('Backing up PostgreSQL database...');
    const connParams = parseConnectionString(databaseUrl);
    const pgDump = findCommand('pg_dump');

    await new Promise<void>((resolve, reject) => {
      const env = { ...process.env, PGPASSWORD: connParams.password };
      const cmd = `"${pgDump}" --host="${connParams.host}" --port="${connParams.port}" --username="${connParams.user}" --no-password "${connParams.database}"`;
      
      const proc = exec(cmd, { env, maxBuffer: 1024 * 1024 * 100 }, (error, stdout) => {
        if (error) {
          console.error('pg_dump error:', error.message);
          reject(error);
        } else {
          fs.writeFileSync(dbBackupFile, stdout);
          resolve();
        }
      });

      proc.on('error', reject);
    });

    console.log('Database backup completed');

    // 2. Copy uploads if they exist
    if (fs.existsSync(uploadsDir)) {
      console.log('Copying uploads...');
      fs.mkdirSync(uploadsBackupDir, { recursive: true });
      
      try {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          const src = path.join(uploadsDir, file);
          const dest = path.join(uploadsBackupDir, file);
          try {
            const stat = fs.statSync(src);
            if (stat.isFile()) {
              fs.copyFileSync(src, dest);
            }
          } catch (err) {
            console.warn(`Skipped ${file}:`, err);
          }
        }
      } catch (err) {
        console.warn('Error copying uploads:', err);
      }
      console.log('Uploads copied');
    }

    // 3. Create tar.gz archive
    console.log('Creating archive...');
    const tarCmd = findCommand('tar');
    const filesToArchive = fs.existsSync(uploadsBackupDir)
      ? 'database.sql uploads'
      : 'database.sql';

    await new Promise<void>((resolve, reject) => {
      exec(
        `"${tarCmd}" -czf "${finalBackupFile}" -C "${tmpDir}" ${filesToArchive}`,
        { maxBuffer: 1024 * 1024 * 100 },
        (error) => {
          if (error) {
            console.error('tar error:', error.message);
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });

    console.log('Archive created');

    // 4. Read backup file
    const backupBuffer = fs.readFileSync(finalBackupFile);
    const timestamp = new Date().toISOString().split('T')[0];

    // 5. Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;

    // 6. Return file
    return new NextResponse(backupBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="backup-${timestamp}.tar.gz"`,
        'Content-Length': backupBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    
    // Cleanup on error
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }

    const message = error?.message || 'Failed to create backup';
    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}

