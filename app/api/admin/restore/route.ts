import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { requireAdminOrRedirect } from '@/lib/rbac';
import { prisma } from '@/lib/db';

// Try to find psql, tar or other commands
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
    ...(cmd === 'psql' || cmd === 'pg_dump' ? getLibpqPaths(cmd) : []),
    
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

function getLibpqPaths(cmd: string = 'psql'): string[] {
  const paths: string[] = [];
  
  try {
    // Check /usr/local/Cellar/libpq for any version
    const cellarPath = '/usr/local/Cellar/libpq';
    if (fs.existsSync(cellarPath)) {
      const versions = fs.readdirSync(cellarPath);
      for (const version of versions) {
        const cmdPath = path.join(cellarPath, version, 'bin', cmd);
        if (fs.existsSync(cmdPath)) {
          paths.push(cmdPath);
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
        const cmdPath = path.join(cellarPath, version, 'bin', cmd);
        if (fs.existsSync(cmdPath)) {
          paths.push(cmdPath);
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
    await requireAdminOrRedirect('/api/admin/restore');

    // Get the uploaded backup file
    const formData = await req.formData();
    const backupFile = formData.get('backup') as File;

    if (!backupFile) {
      return NextResponse.json(
        { message: 'No backup file provided' },
        { status: 400 }
      );
    }

    if (!backupFile.name.endsWith('.tar.gz')) {
      return NextResponse.json(
        { message: 'Backup file must be .tar.gz format' },
        { status: 400 }
      );
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { message: 'DATABASE_URL not configured' },
        { status: 500 }
      );
    }

    // Create temporary directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
    const uploadedBackupPath = path.join(tmpDir, backupFile.name);
    const extractDir = path.join(tmpDir, 'extracted');
    const dbSqlFile = path.join(extractDir, 'database.sql');
    const uploadsDir = path.join(extractDir, 'uploads');

    try {
      // 1. Save uploaded file
      console.log('Saving backup file...');
      const buffer = await backupFile.arrayBuffer();
      fs.writeFileSync(uploadedBackupPath, Buffer.from(buffer));

      // 2. Extract tar.gz
      console.log('Extracting backup...');
      fs.mkdirSync(extractDir, { recursive: true });
      const tarCmd = findCommand('tar');

      await new Promise<void>((resolve, reject) => {
        exec(
          `"${tarCmd}" -xzf "${uploadedBackupPath}" -C "${extractDir}"`,
          { maxBuffer: 1024 * 1024 * 100 },
          (error) => {
            if (error) {
              console.error('tar extraction error:', error.message);
              reject(error);
            } else {
              resolve();
            }
          }
        );
      });

      // 3. Verify database.sql exists
      if (!fs.existsSync(dbSqlFile)) {
        throw new Error('database.sql not found in backup');
      }

      console.log('Backup extracted successfully');

      // 4. Restore database
      console.log('Restoring database...');
      const connParams = parseConnectionString(databaseUrl);
      const psqlCmd = findCommand('psql');

      // First, terminate all connections to the database
      console.log('Terminating active connections...');
      await new Promise<void>((resolve, reject) => {
        const env = { ...process.env, PGPASSWORD: connParams.password };
        
        const terminateCmd = `"${psqlCmd}" --host="${connParams.host}" --port="${connParams.port}" --username="${connParams.user}" --no-password -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${connParams.database}' AND pid <> pg_backend_pid();"`;
        
        exec(terminateCmd, { env, maxBuffer: 1024 * 1024 * 100 }, (error) => {
          if (error) {
            console.error('Terminate connections error:', error.message);
            // Don't reject, continue anyway
          }
          resolve();
        });
      });

      // Now drop the database
      console.log('Dropping database...');
      await new Promise<void>((resolve, reject) => {
        const env = { ...process.env, PGPASSWORD: connParams.password };
        
        const dropCmd = `"${psqlCmd}" --host="${connParams.host}" --port="${connParams.port}" --username="${connParams.user}" --no-password -d postgres -c "DROP DATABASE IF EXISTS ${connParams.database};"`;
        
        exec(dropCmd, { env, maxBuffer: 1024 * 1024 * 100 }, (error) => {
          if (error) {
            console.error('Database drop error:', error.message);
            reject(error);
          } else {
            resolve();
          }
        });
      });

      console.log('Database dropped');

      // Now create the database
      console.log('Creating database...');
      await new Promise<void>((resolve, reject) => {
        const env = { ...process.env, PGPASSWORD: connParams.password };
        
        const createCmd = `"${psqlCmd}" --host="${connParams.host}" --port="${connParams.port}" --username="${connParams.user}" --no-password -d postgres -c "CREATE DATABASE ${connParams.database};"`;
        
        exec(createCmd, { env, maxBuffer: 1024 * 1024 * 100 }, (error) => {
          if (error) {
            console.error('Database create error:', error.message);
            reject(error);
          } else {
            resolve();
          }
        });
      });

      console.log('Database created');

      // Now restore the database dump
      await new Promise<void>((resolve, reject) => {
        const env = { ...process.env, PGPASSWORD: connParams.password };
        const sqlContent = fs.readFileSync(dbSqlFile, 'utf-8');
        
        const restoreCmd = `"${psqlCmd}" --host="${connParams.host}" --port="${connParams.port}" --username="${connParams.user}" --no-password ${connParams.database}`;
        
        const proc = exec(restoreCmd, { env, maxBuffer: 1024 * 1024 * 100 }, (error) => {
          if (error) {
            console.error('Database restore error:', error.message);
            reject(error);
          } else {
            resolve();
          }
        });

        // Pipe the SQL content to psql
        if (proc.stdin) {
          proc.stdin.write(sqlContent);
          proc.stdin.end();
        }
      });

      console.log('Database restored successfully');

      let restoredCount = 0;

      // 5. Restore uploaded files
      if (fs.existsSync(uploadsDir)) {
        console.log('Restoring uploaded files...');
        const uploadTargetDir = path.join(process.cwd(), 'public', 'uploads');
        
        // Clear existing uploads
        if (fs.existsSync(uploadTargetDir)) {
          fs.rmSync(uploadTargetDir, { recursive: true, force: true });
        }
        fs.mkdirSync(uploadTargetDir, { recursive: true });

        // Copy files from backup
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          const src = path.join(uploadsDir, file);
          const dest = path.join(uploadTargetDir, file);
          try {
            const stat = fs.statSync(src);
            if (stat.isFile()) {
              fs.copyFileSync(src, dest);
              restoredCount++;
            }
          } catch (err) {
            console.warn(`Failed to restore file ${file}:`, err);
          }
        }

        console.log(`${restoredCount} files restored`);
      }

      // 6. Clean up
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;

      return NextResponse.json({
        ok: true,
        message: 'Restore completed successfully',
        details: `Database restored, ${restoredCount} files recovered`,
      });
    } catch (error: any) {
      // Clean up on error
      if (tmpDir && fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error('Cleanup error:', cleanupErr);
        }
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Restore error:', error);

    // Cleanup on error
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error('Cleanup error:', cleanupErr);
      }
    }

    const message = error?.message || 'Failed to restore backup';
    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}
