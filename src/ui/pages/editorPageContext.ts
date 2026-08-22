import type { Writable } from "svelte/store";
import type {
  AppSettings,
  GrammarProfile,
} from "../../lib/storage/settings";
import type { DatabaseSummary } from "../../lib/tauri/databases";
import type { GrammarMode, GrammarReport } from "../../lib/utils/grammar";
import type { PageMeta, SpaceMeta } from "../../lib/utils/pageMeta";
import type { I18nKey } from "../../lib/i18n";

export type PaneName = "space" | "settings" | "backlinks";

export type EditorPageContext = {
  activeDatabaseId: string | null;
  readonly activeEntryPath: string | null;
  readonly activePageMeta: PageMeta;
  readonly activeRelativePath: string | null;
  characters: number;
  contents: string;
  databases: DatabaseSummary[];
  databasesOpen: boolean;
  editor: HTMLElement | undefined;
  readonly grammarAutoDiff: boolean;
  readonly grammarAutoFull: boolean;
  grammarCheckedText: string;
  grammarChecking: boolean;
  grammarError: string;
  grammarOpen: boolean;
  readonly grammarProfile: GrammarProfile;
  grammarReport: GrammarReport | null;
  grammarTimer: ReturnType<typeof setTimeout> | undefined;
  isDirty: boolean;
  readonly isRtl: boolean;
  readonly noteDir: string | null;
  noteContents: Record<string, string>;
  noteSaveTimer: ReturnType<typeof setTimeout> | undefined;
  openTabs: string[];
  path: string | null;
  pinnedTabs: string[];
  activeTab: string | null;
  resizing: { pane: PaneName; startX: number; startWidth: number } | null;
  settings: AppSettings;
  settingsOpen: boolean;
  spaceMeta: SpaceMeta;
  spaceNotes: string[];
  spaceRoot: string | null;
  statsTimer: ReturnType<typeof setTimeout> | undefined;
  statusMessage: string;
  words: number;
  readonly t: (
    key: I18nKey,
    values?: Record<string, string | number>,
  ) => string;
};

export type EditorPageActionDeps = {
  locale: Writable<AppSettings["locale"]>;
};

export type EditorPageActions = {
  applyGrammarIssue: (issue: any) => void;
  chooseSpace: () => Promise<void>;
  createSpaceDatabase: (name: string) => Promise<void>;
  createSpaceNote: (
    parentPath: string,
    name: string,
    folder?: boolean,
  ) => Promise<void>;
  deleteSpaceDatabase: (id: string) => Promise<void>;
  deleteSpaceEntry: (relativePath: string) => Promise<void>;
  moveSpaceEntry: (
    relativePath: string,
    destFolder: string,
    siblingOrder?: string[],
  ) => Promise<void>;
  dismissGrammarIssue: (issue: any) => void;
  flushNoteSave: () => Promise<void>;
  generateFromPrompt: (prompt: string) => Promise<string>;
  handleResize: (event: PointerEvent) => void;
  openWikilink: (target: string) => Promise<void>;
  pickActiveCover: () => Promise<void>;
  pickAssets: () => Promise<string>;
  refreshSpace: () => Promise<void>;
  renameSpaceEntry: (relativePath: string, name: string) => Promise<void>;
  renderActiveWikilinkEmbed: (target: string, depth: number) => any;
  resetSettings: () => void;
  resizeWithKeyboard: (event: KeyboardEvent, pane: PaneName) => void;
  resolveActiveWikilink: (target: string) => any;
  resolveAsset: (source: string) => string;
  runGrammarCheck: () => Promise<void>;
  runWithStatus: (action: () => Promise<void>) => Promise<void>;
  selectDatabase: (id: string) => Promise<void>;
  selectSpaceNote: (relativePath: string) => Promise<void>;
  setEditorText: (text: string, nextPath: string | null) => void;
  setGrammarMode: (mode: GrammarMode) => void;
  startResize: (event: PointerEvent, pane: PaneName) => void;
  stopResize: () => void;
  storeAssets: (source: {
    files?: File[];
    paths?: string[];
  }) => Promise<string>;
  toggleGrammar: () => void;
  toggleSpacePane: () => void;
  updateActiveCover: (cover: string | null) => Promise<void>;
  updateActiveCoverPosition: (position: number) => Promise<void>;
  updateActiveIcon: (icon: any) => Promise<void>;
  updateGrammarProfile: (profile: GrammarProfile) => void;
  updateNote: () => void;
  updateSettings: (settings: AppSettings) => void;
};
