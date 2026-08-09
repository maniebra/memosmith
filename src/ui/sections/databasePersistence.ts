import {
  saveDatabaseMeta,
  saveDatabaseRow,
} from "../../lib/tauri/databases";
import type { Database, Row } from "../../lib/utils/database";

type DatabaseGetter = () => Database | null;

export class DatabasePersistence {
  private rowSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private metaSaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private root: () => string,
    private database: DatabaseGetter,
    private onStatus: (message: string) => void,
  ) {}

  persistRow(row: Row, immediate = false) {
    const activeDatabase = this.database();
    if (!activeDatabase) {
      return;
    }
    clearTimeout(this.rowSaveTimers.get(row.id));
    if (immediate) {
      this.rowSaveTimers.delete(row.id);
      this.saveRow(row, activeDatabase.id);
      return;
    }
    this.rowSaveTimers.set(
      row.id,
      setTimeout(() => {
        this.rowSaveTimers.delete(row.id);
        this.saveRow(row, activeDatabase.id);
      }, 400),
    );
  }

  scheduleMetaSave() {
    if (this.metaSaveTimer) {
      clearTimeout(this.metaSaveTimer);
    }
    this.metaSaveTimer = setTimeout(() => {
      this.metaSaveTimer = undefined;
      const activeDatabase = this.database();
      if (activeDatabase) {
        this.saveMeta(activeDatabase);
      }
    }, 300);
  }

  destroy() {
    const activeDatabase = this.database();
    for (const [rowId, timer] of this.rowSaveTimers) {
      clearTimeout(timer);
      const row = activeDatabase?.rows.find((entry) => entry.id === rowId);
      if (row && activeDatabase) {
        this.saveRow(row, activeDatabase.id);
      }
    }
    this.rowSaveTimers.clear();
    if (this.metaSaveTimer) {
      clearTimeout(this.metaSaveTimer);
      if (activeDatabase) {
        this.saveMeta(activeDatabase);
      }
    }
  }

  private report(error: unknown) {
    this.onStatus(error instanceof Error ? error.message : String(error));
  }

  private saveRow(row: Row, databaseId: string) {
    void saveDatabaseRow(this.root(), databaseId, row).catch((error) =>
      this.report(error),
    );
  }

  private saveMeta(activeDatabase: Database) {
    void saveDatabaseMeta(
      this.root(),
      activeDatabase.id,
      activeDatabase.name,
      activeDatabase.tables,
    ).catch((error) => this.report(error));
  }
}
