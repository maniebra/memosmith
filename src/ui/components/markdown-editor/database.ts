import { mount, unmount } from "svelte";
import type { Database } from "../../../lib/utils/database";
import { DATABASE_LANGUAGE } from "../../../lib/utils/markdown";
import DatabaseView from "../../sections/DatabaseView.svelte";
import type { DatabaseApi, DatabaseEmbed, Editor } from "./types";

type DatabasePortal = {
  view: ReturnType<typeof mount>;
  card: HTMLElement;
  host: HTMLElement;
  resizeObserver: ResizeObserver;
};

export function createDatabase(e: Editor): DatabaseApi {
  const service = new EditorDatabase(e);

  return {
    databaseCardFor: service.databaseCardFor.bind(service),
    disposeDatabaseViews: service.disposeDatabaseViews.bind(service),
    enterDatabaseIsland: service.enterDatabaseIsland.bind(service),
    handleDatabaseBlur: service.handleDatabaseBlur.bind(service),
    paintDatabaseEmbeds: service.paintDatabaseEmbeds.bind(service),
    scheduleDatabaseLayout: service.scheduleDatabaseLayout.bind(service),
  };
}

/** Embedded databases are live components parked over the note's own DOM. */
class EditorDatabase {
  /** Live views, keyed by their fenced source. Hosts live outside the editor. */
  private views = new Map<string, DatabasePortal>();
  /** Loaded databases, so a re-render repaints without another round trip. */
  private cache = new Map<string, Database>();
  private layoutFrame: number | undefined;

  constructor(private e: Editor) {}

  private embedSource(preview: HTMLElement) {
    try {
      return JSON.parse(preview.dataset.embed || "{}") as DatabaseEmbed;
    } catch {
      return null;
    }
  }

  /**
   * A re-render rebuilds the note's DOM, which takes the mounted card with it.
   * Remember the cell being typed in so the caret can go back where it was.
   */
  private databaseFocus() {
    const active = document.activeElement as HTMLInputElement | null;
    const cell = active?.closest?.("[data-row][data-column]");
    const card = cell?.closest(".md-database-preview") as HTMLElement | null;

    if (!cell || !card || !("selectionStart" in (active ?? {}))) {
      return null;
    }

    return {
      code: card.dataset.code,
      row: (cell as HTMLElement).dataset.row,
      column: (cell as HTMLElement).dataset.column,
      start: active?.selectionStart ?? null,
      end: active?.selectionEnd ?? null,
    };
  }

  databaseCardFor(event?: Event) {
    const target = event?.target as HTMLElement | null;
    const active = document.activeElement as HTMLElement | null;

    return (target?.closest?.(".md-database-preview") ??
      active?.closest?.(".md-database-preview")) as HTMLElement | null;
  }

  enterDatabaseIsland(event?: Event) {
    if (!this.databaseCardFor(event)) {
      return false;
    }

    this.e.closeMenu();
    this.e.closeCompletions();
    this.e.ui.selectedTableCell = null;
    this.e.markSelectedTableCell();

    return true;
  }

  private restoreDatabaseFocus(focus: ReturnType<EditorDatabase["databaseFocus"]>) {
    if (!focus) {
      return;
    }

    const cell = `[data-row="${focus.row}"][data-column="${focus.column}"]`;
    const input = this.e.databaseLayer
      ?.querySelector(`.md-database-portal[data-code="${focus.code}"]`)
      ?.querySelector(`${cell} input, ${cell} textarea`) as
      | HTMLInputElement
      | null;

    // Focus survived the re-render: leave the caret where the user has it.
    if (!input || document.activeElement === input) {
      return;
    }

    input.focus();

    if (focus.start !== null) {
      const start = Math.min(focus.start, input.value.length);
      const end = Math.min(focus.end ?? start, input.value.length);

      input.setSelectionRange(start, end);
    }
  }

  /**
   * Cells swallow re-renders while they are being typed in. Once focus leaves
   * the card the note catches up in one go.
   */
  handleDatabaseBlur(event: FocusEvent) {
    const target = event.target as HTMLElement | null;
    const card = target?.closest?.(".md-database-preview");

    if (!card) {
      return;
    }

    // A focus bouncing back inside the card is the browser shuffling, not the
    // user leaving: settle first, then decide.
    setTimeout(() => {
      if (!card.contains(document.activeElement)) {
        this.e.render(this.e.caretOffset());
      }
    }, 0);
  }

  private embedKey(preview: HTMLElement) {
    return `${preview.dataset.code}:${preview.dataset.embed}`;
  }

  private positionDatabaseEntry(entry: DatabasePortal) {
    if (!this.e.databaseLayer || !entry.card.isConnected) {
      return;
    }

    const card = entry.card.getBoundingClientRect();
    const layer = this.e.databaseLayer.getBoundingClientRect();

    entry.host.style.left = `${card.left - layer.left}px`;
    entry.host.style.top = `${card.top - layer.top}px`;
    entry.host.style.width = `${card.width}px`;

    const height = entry.host.getBoundingClientRect().height;

    if (height > 0) {
      entry.card.style.height = `${height}px`;
    }
  }

  scheduleDatabaseLayout() {
    if (this.layoutFrame !== undefined) {
      return;
    }

    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = undefined;

      for (const entry of this.views.values()) {
        this.positionDatabaseEntry(entry);
      }
    });
  }

  private disposeDatabaseEntry(entry: DatabasePortal) {
    entry.resizeObserver.disconnect();
    void unmount(entry.view);
    entry.host.remove();
  }

  disposeDatabaseViews() {
    for (const entry of this.views.values()) {
      this.disposeDatabaseEntry(entry);
    }

    this.views.clear();
  }

  private entryForHost(host: HTMLElement) {
    for (const entry of this.views.values()) {
      if (entry.host === host) {
        return entry;
      }
    }

    return null;
  }

  private createDatabaseHost(preview: HTMLElement) {
    const host = document.createElement("div");

    host.className = "md-database-preview md-database-portal";
    host.dataset.code = preview.dataset.code ?? "";
    host.dataset.embed = preview.dataset.embed ?? "";
    host.contentEditable = "false";
    host.style.position = "absolute";

    this.e.databaseLayer?.append(host);

    return host;
  }

  private portalProps(
    anchor: HTMLElement,
    host: HTMLElement,
    embed: DatabaseEmbed,
    databaseId: string,
  ) {
    const props = this.e.props;

    return {
      root: props.databaseRoot,
      databaseId,
      compact: true,
      preloaded: this.cache.get(databaseId) ?? null,
      tableId: embed.table ?? null,
      viewId: embed.view ?? null,
      databaseOptions: props.databaseOptions,
      onStatus: props.onStatus,
      onRenamed: () => {},
      onOpen: props.onOpenDatabase
        ? () => props.onOpenDatabase?.(databaseId)
        : null,
      onChange: (database: Database) => this.cache.set(database.id, database),
      onNavigate: (tableId: string, viewId: string) => {
        const current = this.entryForHost(host)?.card ?? anchor;

        this.writeDatabaseEmbed(current, {
          database: databaseId,
          table: tableId,
          view: viewId,
        });
      },
    };
  }

  private mountDatabaseEntry(
    anchor: HTMLElement,
    embed: DatabaseEmbed,
    key: string,
  ) {
    if (!embed.database) {
      return;
    }

    const databaseId = embed.database;
    const host = this.createDatabaseHost(anchor);
    const resizeObserver = new ResizeObserver(() =>
      this.scheduleDatabaseLayout(),
    );

    resizeObserver.observe(host);

    this.views.set(key, {
      card: anchor,
      view: mount(DatabaseView, {
        target: host,
        props: this.portalProps(anchor, host, embed, databaseId),
      }),
      host,
      resizeObserver,
    });
    this.scheduleDatabaseLayout();
  }

  private removeStaleEntries(live: Set<string>) {
    for (const [key, entry] of this.views) {
      if (!live.has(key)) {
        this.disposeDatabaseEntry(entry);
        this.views.delete(key);
      }
    }
  }

  private paintDatabaseEmbed(anchor: HTMLElement) {
    const embed = this.e.props.databaseRoot ? this.embedSource(anchor) : null;
    const key = this.embedKey(anchor);
    const existing = this.views.get(key);

    if (existing) {
      existing.card = anchor;
      existing.host.dataset.code = anchor.dataset.code ?? "";
      existing.host.dataset.embed = anchor.dataset.embed ?? "";
      this.scheduleDatabaseLayout();
      return;
    }

    if (!embed?.database) {
      const unavailable = this.e.t("database.unavailable");

      anchor.classList.remove("md-database-anchor");
      anchor.innerHTML = `<p class="md-database-empty">${unavailable}</p>`;
      return;
    }

    this.mountDatabaseEntry(anchor, embed, key);
  }

  paintDatabaseEmbeds() {
    const focus = this.databaseFocus();
    const live = new Set<string>();
    const previews = this.e.element?.querySelectorAll(".md-database-preview");

    for (const preview of Array.from(previews ?? [])) {
      const anchor = preview as HTMLElement;

      live.add(this.embedKey(anchor));
      this.paintDatabaseEmbed(anchor);
    }

    this.removeStaleEntries(live);
    this.restoreDatabaseFocus(focus);
  }

  /** Keeps the fence JSON in step with the tab the card is showing. */
  private writeDatabaseEmbed(preview: HTMLElement, embed: DatabaseEmbed) {
    const source = JSON.stringify(embed);

    if (source === preview.dataset.embed || !this.e.props.editable) {
      return;
    }

    const previous = this.embedKey(preview);

    preview.dataset.embed = source;

    const entry = this.views.get(previous);

    if (entry) {
      this.views.delete(previous);
      this.views.set(this.embedKey(preview), entry);
    }

    this.e.replaceFencedSource(preview, DATABASE_LANGUAGE, source, false);
  }
}
