const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { liveDiagramFenceLine, renderDocument } from "../../../src/lib/utils/markdown";
const sourceBlocksFromHtml = (html: string) =>
  (html.match(/class="[^"]*\bmd-block\b[^"]*"/g) ?? []).length;
const sourceBlocks = (text: string) =>
  sourceBlocksFromHtml(renderDocument(text));
const drawing = renderDocument(
  '```excalidraw\n{"elements":[]}\n```',
  undefined,
  { drawings: true },
);
assert(
  drawing.includes("md-drawing-preview"),
  "drawing fence gets a preview card",
);
assert(
  (drawing.match(/md-drawing-line/g) ?? []).length === 3,
  "fences and scene line are collapsed",
);
assert(
  !renderDocument("```excalidraw\n{}\n```").includes("md-drawing"),
  "drawing block stays a plain code block while the feature is off",
);
assert(
  !renderDocument("```js\nlet a\n```", undefined, { drawings: true }).includes(
    "md-drawing",
  ),
  "other languages are untouched",
);

const diagram = renderDocument(
  '```drawio\n{"xml":"","svg":""}\n```',
  undefined,
  { diagrams: true },
);
assert(
  diagram.includes("md-diagram-preview"),
  "drawio fence gets a preview card",
);
assert(
  (diagram.match(/md-diagram-line/g) ?? []).length === 3,
  "diagram fences and source are collapsed",
);
assert(
  (diagram.match(/contenteditable="false"/g) ?? []).length === 4,
  "diagram source lines and preview stay uneditable, so the caret never unfolds the XML",
);
const staticDiagram = renderDocument(
  '```drawio\n{"svg":"<svg><rect /></svg>"}\n```',
  undefined,
  {
    diagrams: true,
    staticDiagramPreviews: true,
  },
);
assert(
  staticDiagram.includes("md-diagram-static-preview"),
  "static diagram preview is marked",
);
assert(
  staticDiagram.includes("<svg><rect /></svg>"),
  "static diagram preview renders cached svg",
);
assert(
  !renderDocument("```drawio\n{}\n```").includes("md-diagram"),
  "diagram block stays a plain code block while the feature is off",
);
assert(
  renderDocument("```drawio\n{}\n```\n\n```js\nlet a\n```", undefined, {
    diagrams: true,
  }).includes("md-codeblock"),
  "a code block after a diagram block is still code",
);

const databaseEmbed = renderDocument(
  '```database\n{"database":"db1"}\n```',
  undefined,
  {
    databaseEmbeds: true,
  },
);

assert(
  databaseEmbed.includes("md-database-preview"),
  "database fence renders a preview card",
);
assert(
  databaseEmbed.includes('data-embed="{&quot;database&quot;:&quot;db1&quot;}"'),
  "the card carries its embed source for the editor to mount into",
);
assert(
  !renderDocument("```database\n{}\n```").includes("md-database-preview"),
  "database embeds stay off by default",
);

// Code execution: only closed, runnable fences grow a run bar, and only when the feature is on.
const runBars = (text: string, codeExecution: boolean) =>
  (
    renderDocument(text, undefined, { codeExecution }).match(
      /md-run-preview/g,
    ) ?? []
  ).length;

assert(
  runBars("```python\nprint(1)\n```", true) === 1,
  "runnable fence gets a run bar",
);
assert(
  runBars("```python\nprint(1)\n```", false) === 0,
  "run bars need the feature on",
);
assert(
  runBars("```not-a-kernel\ntext\n```", true) === 0,
  "unrunnable language gets no run bar",
);
assert(
  runBars("```bash\necho hi\n", true) === 0,
  "an unclosed fence gets no run bar",
);
assert(
  sourceBlocks("```python\nprint(1)\n```") === 3,
  "the run bar is not a source block",
);

const plantumlSource = "```plantuml\n@startuml\nA -> B\n@enduml\n```";
const plantuml = renderDocument(plantumlSource, undefined, { plantuml: true });
assert(
  plantuml.includes("md-livediagram-preview"),
  "plantuml fences get a preview",
);
assert(plantuml.includes("@startuml"), "plantuml source stays visible as code");
assert(
  plantuml.includes('data-livediagram="@startuml\nA -&gt; B\n@enduml"'),
  "preview carries the source",
);
assert(
  !renderDocument(plantumlSource).includes("md-livediagram"),
  "plantuml stays off by default",
);
assert(
  renderDocument(
    "```plantuml\n@startuml\n@enduml\n```\n```js\nlet a\n```",
    undefined,
    { plantuml: true },
  ).match(/md-livediagram-preview/g)?.length === 1,
  "only plantuml fences get a diagram preview",
);
const alignedPlantuml = renderDocument(
  "```plantuml|center|420\n@startuml\n@enduml\n```",
  undefined,
  {
    plantuml: true,
  },
);
assert(
  alignedPlantuml.includes("justify-content:center"),
  "fence options align the diagram",
);
assert(
  alignedPlantuml.includes('data-livediagram-width="420"'),
  "fence options size the diagram",
);
assert(
  alignedPlantuml.includes("md-livediagram-line"),
  "diagram source collapses when not focused",
);
assert(
  liveDiagramFenceLine("plantuml", "right", 300) === "```plantuml|right|300",
  "options round-trip",
);
assert(
  liveDiagramFenceLine("puml") === "```puml",
  "a plain diagram keeps a plain fence",
);

// Mermaid rides the same path as PlantUML, behind its own switch.
const mermaidSource = "```mermaid\nflowchart LR\n  A --> B\n```";
const mermaid = renderDocument(mermaidSource, undefined, { mermaid: true });
assert(
  mermaid.includes('data-livediagram-engine="mermaid"'),
  "mermaid fences name their engine",
);
assert(
  mermaid.includes("md-livediagram-line"),
  "mermaid source collapses when not focused",
);
assert(
  !renderDocument(mermaidSource, undefined, { plantuml: true }).includes(
    "md-livediagram",
  ),
  "the plantuml switch does not enable mermaid",
);
assert(
  renderDocument(plantumlSource, undefined, { mermaid: true }).includes(
    "md-livediagram",
  ) === false,
  "the mermaid switch does not enable plantuml",
);

console.log("markdown diagrams ok");
