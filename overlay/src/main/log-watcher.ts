import * as chokidar from "chokidar";
import * as fs from "fs";

// PoE log line format:
// 2024/01/15 12:34:56 [INFO Client 12345] : You have entered Lioneye's Watch.
const ZONE_REGEX = /\] : You have entered (.+)\.$/;

export class LogWatcher {
  private filePath: string;
  private onZoneEntered: (zoneName: string) => void;
  private watcher: chokidar.FSWatcher | null = null;
  private fileHandle: number | null = null;
  private filePosition = 0;

  constructor(filePath: string, onZoneEntered: (zoneName: string) => void) {
    this.filePath = filePath;
    this.onZoneEntered = onZoneEntered;
  }

  start(): void {
    // Seek to end of file so we don't replay history on startup
    try {
      const stat = fs.statSync(this.filePath);
      this.filePosition = stat.size;
    } catch {
      this.filePosition = 0;
    }

    this.watcher = chokidar.watch(this.filePath, {
      persistent: true,
      usePolling: false,
      awaitWriteFinish: false,
    });

    this.watcher.on("change", () => this.readNewLines());
    this.watcher.on("error", (err) => {
      console.error("LogWatcher error:", err);
    });

    console.log(`LogWatcher started: ${this.filePath}`);
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.fileHandle !== null) {
      fs.closeSync(this.fileHandle);
      this.fileHandle = null;
    }
    console.log("LogWatcher stopped");
  }

  private readNewLines(): void {
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.size < this.filePosition) {
        // File was rotated/truncated — reset to beginning
        this.filePosition = 0;
      }

      if (stat.size === this.filePosition) return;

      const fd = fs.openSync(this.filePath, "r");
      const bytesToRead = stat.size - this.filePosition;
      const buffer = Buffer.alloc(bytesToRead);
      fs.readSync(fd, buffer, 0, bytesToRead, this.filePosition);
      fs.closeSync(fd);

      this.filePosition = stat.size;

      const newContent = buffer.toString("utf-8");
      const lines = newContent.split(/\r?\n/);

      for (const line of lines) {
        const match = ZONE_REGEX.exec(line);
        if (match) {
          const zoneName = match[1].trim();
          console.log(`Zone entered: ${zoneName}`);
          this.onZoneEntered(zoneName);
        }
      }
    } catch (err) {
      console.error("LogWatcher read error:", err);
    }
  }
}
