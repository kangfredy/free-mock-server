import * as fs from 'fs';
import * as path from 'path';

export type FileChangeCallback = () => void;

export function watchDirectory(dirPath: string, callback: FileChangeCallback, debounceMs: number = 500) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`⚠️  Directory not found: ${dirPath}`);
    return () => {};
  }

  let debounceTimer: NodeJS.Timeout | null = null;
  let isWatching = true;

  const triggerReload = () => {
    if (!isWatching) return;
    
    // Debounce: wait for multiple rapid changes to finish
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      console.log('\n🔄 File change detected, reloading routes...');
      callback();
    }, debounceMs);
  };

  const watchRecursive = (dir: string) => {
    try {
      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const filePath = path.join(dir, filename);
        
        // Only watch for JSON files (request/response files)
        if (filename.endsWith('.json')) {
          // Ignore temporary files
          if (filename.startsWith('.') || filename.includes('~')) {
            return;
          }

          console.log(`📝 File ${eventType}: ${filename}`);
          triggerReload();
        }
      });

      watcher.on('error', (error) => {
        console.error('❌ File watcher error:', error);
      });

      return watcher;
    } catch (error) {
      console.error(`❌ Error watching directory ${dir}:`, error);
      return null;
    }
  };

  const watcher = watchRecursive(dirPath);

  // Return cleanup function
  return () => {
    isWatching = false;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (watcher) {
      watcher.close();
    }
    console.log('🛑 File watcher stopped');
  };
}

