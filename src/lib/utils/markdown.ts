import hljs from "highlight.js/lib/common";

type BlockRule = {
  match: RegExp;
  className: string;
  /** Hide the markdown marker when the caret is elsewhere. */
  hideMark?: boolean;
};

const BLOCK_RULES: BlockRule[] = [
  { match: /^# /, className: "md-h1", hideMark: true },
  { match: /^## /, className: "md-h2", hideMark: true },
  { match: /^### /, className: "md-h3", hideMark: true },
  { match: /^#{4,6} /, className: "md-h4", hideMark: true },
  { match: /^\s*[-*+] \[x\] /i, className: "md-task md-task-done", hideMark: true },
  { match: /^\s*[-*+] \[ \] /, className: "md-task", hideMark: true },
  { match: /^\s*[-*+] /, className: "md-bullet", hideMark: true },
  { match: /^\s*\d+\. /, className: "md-ordered" },
  { match: /^> /, className: "md-quote", hideMark: true },
  { match: /^(-{3,}|\*{3,}|_{3,})$/, className: "md-rule", hideMark: true },
];

/** One pass so replacements are never rescanned as markdown. */
const INLINE = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|(?<![*\w])\*(\S|\S[^*\n]*\S)\*(?!\*)|\[([^\]\n]*)\]\(([^)\n]*)\)/g;

function mark(text: string) {
  return `<span class="md-mark">${text}</span>`;
}

function renderInline(escaped: string) {
  return escaped.replace(INLINE, (all, code, bold, italic, linkText, href) => {
    if (code) {
      return `<span class="md-code">${mark("`")}${code}${mark("`")}</span>`;
    }

    if (bold) {
      return `<span class="md-bold">${mark("**")}${bold}${mark("**")}</span>`;
    }

    if (italic) {
      return `<span class="md-italic">${mark("*")}${italic}${mark("*")}</span>`;
    }

    if (linkText !== undefined) {
      return `<span class="md-link">${mark("[")}${linkText}${mark(`](${href})`)}</span>`;
    }

    return all;
  });
}

export const SLASH_COMMANDS = [
  { label: "Heading 1", hint: "#", prefix: "# " },
  { label: "Heading 2", hint: "##", prefix: "## " },
  { label: "Heading 3", hint: "###", prefix: "### " },
  { label: "Bulleted list", hint: "-", prefix: "- " },
  { label: "Numbered list", hint: "1.", prefix: "1. " },
  { label: "To-do", hint: "[ ]", prefix: "- [ ] " },
  { label: "Quote", hint: ">", prefix: "> " },
  { label: "Code", hint: "```", prefix: "```" },
  { label: "Divider", hint: "---", prefix: "---" },
  { label: "Text", hint: "plain", prefix: "" },
];

export function escapeHtml(text: string) {
  return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

function blockRule(line: string) {
  return BLOCK_RULES.find((rule) => rule.match.test(line));
}

export function lineClass(line: string) {
  return blockRule(line)?.className ?? "";
}

export function renderLine(line: string) {
  if (!line) {
    return "<br>";
  }

  const rule = blockRule(line);
  const prefix = rule?.hideMark ? rule.match.exec(line)![0] : "";
  const body = renderInline(escapeHtml(line.slice(prefix.length)));

  return `${prefix ? mark(escapeHtml(prefix)) : ""}${body || "<br>"}`;
}

const FENCE = /^\s*```(\w*)/;

/** Highlighting is per line so each line stays one block the caret can map onto. */
function renderCode(line: string, language: string) {
  if (!line) {
    return "<br>";
  }

  if (!language || !hljs.getLanguage(language)) {
    return escapeHtml(line);
  }

  return hljs.highlight(line, { language, ignoreIllegals: true }).value;
}

/** True when the text ends inside an unclosed fence. */
export function insideFence(text: string) {
  return (text.match(/^[ \t]*```/gm) ?? []).length % 2 === 1;
}

export function renderDocument(text: string) {
  let language: string | null = null;
  let group = 0;

  return text
    .split("\n")
    .map((line) => {
      const fence = FENCE.exec(line);

      if (fence) {
        const isOpening = language === null;
        const className = isOpening ? "md-fence md-fence-open" : "md-fence md-fence-close";

        language = isOpening ? fence[1].toLowerCase() : null;
        const index = isOpening ? group : group++;

        return `<div class="md-block ${className}" data-code="${index}">${escapeHtml(line)}</div>`;
      }

      if (language !== null) {
        return `<div class="md-block md-codeblock" data-code="${group}">${renderCode(line, language)}</div>`;
      }

      const indent = / */.exec(line)![0].length;
      const style = indent ? ` style="padding-left:${indent * 0.75}rem"` : "";

      return `<div class="md-block ${lineClass(line)}"${style}>${renderLine(line)}</div>`;
    })
    .join("");
}

/** Prefix to start the next line with when Enter is pressed inside a list. */
export function continueList(line: string): string {
  const match = /^(\s*)([-*+]|(\d+)\.)( \[[ x]\])? /.exec(line);

  if (!match) {
    return "";
  }

  const [prefix, indent, bullet, ordinal, task] = match;

  if (line.length === prefix.length) {
    return "";
  }

  const nextBullet = ordinal ? `${Number(ordinal) + 1}.` : bullet;

  return `${indent}${nextBullet}${task ? " [ ]" : ""} `;
}

export function stripPrefix(line: string) {
  return line.replace(/^\s*(#{1,6} |> |([-*+]|\d+\.)( \[[ x]\])? |```)/, "");
}

export function applyPrefix(line: string, prefix: string) {
  return prefix + stripPrefix(line);
}
