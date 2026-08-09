import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Code2,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Plus,
  Quote,
  Trash2,
  Type,
} from "@lucide/svelte";
import { applyPrefix } from "../../../lib/utils/markdown";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { BlockEditApi, BlockTransform, Editor } from "./types";

export const BLOCK_TRANSFORMS: BlockTransform[] = [
  { labelKey: "editor.text", prefix: "", icon: Type },
  { labelKey: "editor.heading1", prefix: "# ", icon: Heading1 },
  { labelKey: "editor.heading2", prefix: "## ", icon: Heading2 },
  { labelKey: "editor.heading3", prefix: "### ", icon: Heading3 },
  { labelKey: "editor.bulletedList", prefix: "- ", icon: List },
  { labelKey: "editor.numberedList", prefix: "1. ", icon: ListOrdered },
  { labelKey: "editor.todo", prefix: "- [ ] ", icon: CheckSquare },
  { labelKey: "editor.quote", prefix: "> ", icon: Quote },
  { labelKey: "editor.code", prefix: "```", icon: Code2 },
];

export function createBlockEdit(e: Editor): BlockEditApi {
  const service = new EditorBlockEdit(e);

  return {
    addBlockAfter: service.addBlockAfter.bind(service),
    blockContextItems: service.blockContextItems.bind(service),
    handleTailPointerDown: service.handleTailPointerDown.bind(service),
    openTailBlock: service.openTailBlock.bind(service),
  };
}

/** Adding, moving, duplicating and reshaping whole blocks. */
class EditorBlockEdit {
  constructor(private e: Editor) {}

  addBlockAfter() {
    const e = this.e;
    const context = e.unitContext();

    if (!context) {
      const end = e.value.length;

      e.replace(end, end, e.value ? "\n" : "", end + (e.value ? 1 : 0));
      return;
    }

    const chunks = e.unitChunks(context.units);
    const insertionIndex = context.index + 1;

    chunks.splice(insertionIndex, 0, "");
    e.commitChunks(chunks, insertionIndex);
  }

  openTailBlock() {
    const e = this.e;
    const snapshot = e.scrollSnapshot();

    e.closeMenu();
    e.closeCompletions();

    if (!e.value || e.value.endsWith("\n")) {
      e.render(e.value.length);
    } else {
      e.replace(e.value.length, e.value.length, "\n");
    }

    e.element?.focus({ preventScroll: true });
    e.restoreScrollSnapshot(snapshot);
    requestAnimationFrame(() => e.restoreScrollSnapshot(snapshot));
  }

  handleTailPointerDown(event: PointerEvent) {
    const e = this.e;

    if (!e.props.editable || !e.element || event.target !== e.element) {
      return false;
    }

    const units = e.sourceUnits();
    const lastUnit = units[units.length - 1];
    const lastRect = lastUnit ? e.unitVisualRect(lastUnit) : null;

    if (lastRect && event.clientY < lastRect.bottom) {
      return false;
    }

    event.preventDefault();
    this.openTailBlock();
    return true;
  }

  private duplicateBlock() {
    const e = this.e;
    const context = e.unitContext();

    if (!context) {
      return;
    }

    const chunks = e.unitChunks(context.units);
    const text = chunks[context.index];

    chunks.splice(context.index + 1, 0, text);
    e.commitChunks(chunks, context.index + 1, text.length);
  }

  private deleteBlock() {
    const e = this.e;
    const context = e.unitContext();

    if (!context) {
      return;
    }

    const chunks = e.unitChunks(context.units);

    chunks.splice(context.index, 1);
    e.commitChunks(
      chunks,
      Math.min(context.index, Math.max(0, chunks.length - 1)),
    );
  }

  private moveBlock(direction: -1 | 1) {
    const e = this.e;
    const context = e.unitContext();
    const targetIndex = context ? context.index + direction : -1;

    if (!context || targetIndex < 0 || targetIndex >= context.units.length) {
      return;
    }

    const chunks = e.unitChunks(context.units);
    const [chunk] = chunks.splice(context.index, 1);

    chunks.splice(targetIndex, 0, chunk);
    e.commitChunks(chunks, targetIndex);
  }

  private transformBlock(transform: BlockTransform) {
    const e = this.e;
    const context = e.unitContext();

    if (!context) {
      return;
    }

    const chunks = e.unitChunks(context.units);
    const text = chunks[context.index];
    const lines = text.split("\n");

    if (transform.prefix === "```") {
      const fenced =
        lines[0]?.trim().startsWith("```") &&
        lines[lines.length - 1]?.trim().startsWith("```");

      chunks[context.index] = fenced
        ? lines.slice(1, -1).join("\n")
        : `\`\`\`\n${text}\n\`\`\``;
      e.commitChunks(chunks, context.index, fenced ? 0 : 4);
      return;
    }

    chunks[context.index] = [
      applyPrefix(lines[0] ?? "", transform.prefix),
      ...lines.slice(1),
    ].join("\n");
    e.commitChunks(chunks, context.index, transform.prefix.length);
  }

  private transformItems(canTransform: boolean): ContextMenuItem[] {
    return BLOCK_TRANSFORMS.map((transform) => ({
      label: this.e.t(transform.labelKey),
      icon: transform.icon,
      disabled: !canTransform,
      onSelect: () => this.transformBlock(transform),
    }));
  }

  blockContextItems(): ContextMenuItem[] {
    const e = this.e;
    const context = e.unitContext();
    const canTransform = Boolean(
      context &&
        (context.unit.blocks.length === 1 ||
          context.unit.key.startsWith("code:")),
    );

    return [
      ...this.transformItems(canTransform),
      { separator: true },
      {
        label: e.t("editor.addBlockBelow"),
        icon: Plus,
        disabled: !e.props.editable,
        onSelect: () => this.addBlockAfter(),
      },
      {
        label: e.t("editor.duplicate"),
        icon: Copy,
        disabled: !context,
        onSelect: () => this.duplicateBlock(),
      },
      {
        label: e.t("editor.moveUp"),
        icon: ArrowUp,
        disabled: !context || context.index === 0,
        onSelect: () => this.moveBlock(-1),
      },
      {
        label: e.t("editor.moveDown"),
        icon: ArrowDown,
        disabled: !context || context.index === context.units.length - 1,
        onSelect: () => this.moveBlock(1),
      },
      { separator: true },
      {
        label: e.t("common.delete"),
        icon: Trash2,
        danger: true,
        disabled: !context,
        onSelect: () => this.deleteBlock(),
      },
    ];
  }
}
