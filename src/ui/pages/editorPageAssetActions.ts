import { convertFileSrc } from "@tauri-apps/api/core";
import { chooseFiles, copyAsset, writeAsset } from "../../lib/tauri/files";
import { generateContent } from "../../lib/tauri/llm";
import { assetFolder, assetMarkdown } from "../../lib/utils/assets";
import { compressImage } from "../../lib/utils/image";
import {
  basename,
  isAbsolutePath,
  joinPath,
  normalizePath,
  relativePath,
} from "../../lib/utils/path";
import type { EditorPageContext } from "./editorPageContext";

type MetaActions = {
  updateActiveCover: (cover: string | null) => Promise<void>;
};

export function createAssetActions(
  context: EditorPageContext,
  meta: MetaActions,
) {
  const service = new AssetActions(context, meta);
  return {
    generateFromPrompt: service.generateFromPrompt.bind(service),
    pickActiveCover: service.pickActiveCover.bind(service),
    pickAssets: service.pickAssets.bind(service),
    resolveAsset: service.resolveAsset.bind(service),
    resolveAssetFromDir: service.resolveAssetFromDir.bind(service),
    storeAssets: service.storeAssets.bind(service),
  };
}

class AssetActions {
  constructor(
    private context: EditorPageContext,
    private meta: MetaActions,
  ) {}

  async storeAssets(source: { files?: File[]; paths?: string[] }) {
    if (!this.context.noteDir) {
      return "";
    }
    const stored = [
      ...(await storeDroppedFiles(source.files ?? [], this.assetDir)),
      ...(await storePickedPaths(source.paths ?? [], this.assetDir)),
    ];
    this.context.statusMessage = this.context.t("app.addedFiles", {
      count: stored.length,
      files: this.context.t(stored.length === 1 ? "app.file" : "app.files"),
    });
    return stored
      .map((assetPath) => assetMarkdown(this.relativeToNote(assetPath)))
      .join("\n");
  }

  async pickAssets() {
    const paths = await chooseFiles();
    return paths.length ? this.storeAssets({ paths }) : "";
  }

  async pickActiveCover() {
    if (!this.context.path || !this.context.noteDir) {
      return;
    }
    const paths = await chooseFiles();
    const coverPath = paths[0];
    if (!coverPath) {
      return;
    }
    const stored = await copyAsset(
      `${this.context.noteDir}/assets/images`,
      coverPath,
    );
    await this.meta.updateActiveCover(this.relativeToNote(stored));
    this.context.statusMessage = this.context.t("app.updatedCover");
  }

  async generateFromPrompt(prompt: string) {
    this.context.statusMessage = this.context.t("app.generating");
    try {
      const generated = await generateContent(
        this.context.settings.llm,
        prompt,
      );
      this.context.statusMessage = this.context.t("app.generatedContent");
      return generated;
    } catch (error) {
      this.context.statusMessage =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  resolveAssetFromDir(dir: string | null, source: string) {
    if (/^[a-z][\w+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) {
      return source;
    }
    const path = normalizePath(decodeURI(source));

    if (isAbsolutePath(path)) {
      return convertFileSrc(path);
    }

    return dir ? convertFileSrc(joinPath(dir, path)) : source;
  }

  resolveAsset(source: string) {
    return this.resolveAssetFromDir(this.context.noteDir, source);
  }

  private assetDir = (name: string, mime = "") => {
    return joinPath(
      this.context.noteDir ?? "",
      "assets",
      assetFolder(name, mime),
    );
  };

  private relativeToNote(assetPath: string) {
    return relativePath(this.context.noteDir ?? "", assetPath) ??
      normalizePath(assetPath);
  }
}

async function storeDroppedFiles(
  files: File[],
  assetDir: (name: string, mime?: string) => string,
) {
  const stored: string[] = [];
  for (const file of files) {
    const compressed = await compressImage(file);
    const name =
      compressed.name ||
      `pasted-${Date.now()}.${compressed.blob.type.split("/")[1] || "bin"}`;
    const bytes = Array.from(
      new Uint8Array(await compressed.blob.arrayBuffer()),
    );
    stored.push(
      await writeAsset(assetDir(name, compressed.blob.type), name, bytes),
    );
  }
  return stored;
}

async function storePickedPaths(
  paths: string[],
  assetDir: (name: string, mime?: string) => string,
) {
  const stored: string[] = [];
  for (const filePath of paths) {
    stored.push(await copyAsset(assetDir(basename(filePath)), filePath));
  }
  return stored;
}
