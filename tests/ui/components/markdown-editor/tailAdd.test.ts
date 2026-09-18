const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { createBlocks } from "../../../../src/ui/components/markdown-editor/blocks";
import type { Editor } from "../../../../src/ui/components/markdown-editor/types";

/** A block that grows after it renders, the way a diagram does. */
function block(height: number, top: number) {
  let current = height;

  return {
    grow: (next: number) => (current = next),
    getBoundingClientRect: () => ({ top, bottom: top + current, height: current }),
  };
}

function harness() {
  const tall = block(20, 10);
  const short = block(10, 40);
  const children = [tall, short];
  let observed: unknown[] = [];
  let notify = () => {};

  (globalThis as Record<string, unknown>).requestAnimationFrame = (
    run: () => void,
  ) => (run(), 0);
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    constructor(private readonly run: () => void) {}
    disconnect() {
      observed = [];
    }
    observe(target: unknown) {
      observed.push(target);
      notify = this.run;
    }
  };

  const editor = {
    shell: { getBoundingClientRect: () => ({ top: 0 }) },
    element: {
      children,
      getBoundingClientRect: () => ({ top: 0 }),
    },
    props: { editable: true },
    ui: { tailAddTop: 0 },
  } as unknown as Editor;

  const blocks = createBlocks(editor);
  editor.syncTailAdd = blocks.syncTailAdd;

  return { editor, blocks, tall, observed: () => observed, notify: () => notify() };
}

const { editor, blocks, tall, observed, notify } = harness();

blocks.syncTailAdd();
assert(editor.ui.tailAddTop === 52, `tail below tallest bottom, got ${editor.ui.tailAddTop}`);
assert(observed().length === 2, "every block is watched for growth");

tall.grow(200);
notify();
assert(
  editor.ui.tailAddTop === 212,
  `tail follows a block that grew, got ${editor.ui.tailAddTop}`,
);

console.log("tailAdd ok");
