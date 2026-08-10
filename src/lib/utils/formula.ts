/**
 * Tiny expression language for formula columns.
 *
 * `{Column Name}` reads another cell, plus numbers, strings, `+ - * / %`,
 * comparisons, `and`/`or`/`not`, and the functions below. Precedence climbing,
 * no statements, no assignment — an expression always evaluates to one value.
 */
export type FormulaValue = string | number | boolean | null;

type Token =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "prop"; value: string }
  | { kind: "name"; value: string }
  | { kind: "op"; value: string };

const OPERATORS = [
  "==",
  "!=",
  ">=",
  "<=",
  ">",
  "<",
  "+",
  "-",
  "*",
  "/",
  "%",
  "(",
  ")",
  ",",
];

export class FormulaError extends Error {}

/** Reads one `{property}`, string, number or name at `index`; null when none starts there. */
function scanAtom(source: string, index: number): [Token, number] | null {
  const character = source[index];

  if (character === "{") {
    const end = source.indexOf("}", index);
    if (end === -1) {
      throw new FormulaError("Unclosed {property}");
    }
    return [{ kind: "prop", value: source.slice(index + 1, end).trim() }, end + 1];
  }

  if (character === '"' || character === "'") {
    let end = index + 1;
    let value = "";
    while (end < source.length && source[end] !== character) {
      // A backslash escapes the next character, so quotes can appear inside.
      value += source[end] === "\\" ? source[++end] : source[end];
      end += 1;
    }
    if (end >= source.length) {
      throw new FormulaError("Unclosed string");
    }
    return [{ kind: "string", value }, end + 1];
  }

  if (/[0-9]/.test(character)) {
    const digits = /^[0-9]*\.?[0-9]+/.exec(source.slice(index));
    if (digits) {
      return [{ kind: "number", value: Number(digits[0]) }, index + digits[0].length];
    }
  }

  const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
  return name ? [{ kind: "name", value: name[0] }, index + name[0].length] : null;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }

    const atom = scanAtom(source, index);
    if (atom) {
      tokens.push(atom[0]);
      index = atom[1];
      continue;
    }

    const operator = OPERATORS.find((entry) => source.startsWith(entry, index));
    if (!operator) {
      throw new FormulaError(`Unexpected character ${source[index]}`);
    }
    tokens.push({ kind: "op", value: operator });
    index += operator.length;
  }

  return tokens;
}
import { functions, toNumber, toText, truthy } from "./formulaFunctions";

export const formulaFunctions = Object.keys(functions).sort();

const BINARY: Record<string, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "!=": 3,
  ">": 4,
  "<": 4,
  ">=": 4,
  "<=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

function apply(
  operator: string,
  left: FormulaValue,
  right: FormulaValue,
): FormulaValue {
  switch (operator) {
    case "or":
      return truthy(left) || truthy(right);
    case "and":
      return truthy(left) && truthy(right);
    case "==":
      return typeof left === "number" || typeof right === "number"
        ? toNumber(left) === toNumber(right)
        : toText(left) === toText(right);
    case "!=":
      return !truthy(apply("==", left, right));
    case ">":
      return compare(left, right) > 0;
    case "<":
      return compare(left, right) < 0;
    case ">=":
      return compare(left, right) >= 0;
    case "<=":
      return compare(left, right) <= 0;
    // Strings concatenate, so `{Name} + "!"` reads the way it looks.
    case "+":
      return typeof left === "string" || typeof right === "string"
        ? toText(left) + toText(right)
        : toNumber(left) + toNumber(right);
    case "-":
      return toNumber(left) - toNumber(right);
    case "*":
      return toNumber(left) * toNumber(right);
    case "/":
      return toNumber(right) === 0 ? null : toNumber(left) / toNumber(right);
    case "%":
      return toNumber(right) === 0 ? null : toNumber(left) % toNumber(right);
    default:
      throw new FormulaError(`Unknown operator ${operator}`);
  }
}

function compare(left: FormulaValue, right: FormulaValue) {
  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  return toNumber(left) - toNumber(right);
}

type Node = (lookup: (name: string) => FormulaValue) => FormulaValue;

/** Token cursor shared by the parsing functions below. */
type Cursor = { tokens: Token[]; position: number };

function peek(cursor: Cursor) {
  return cursor.tokens[cursor.position];
}

/** Consumes the next token when it is `value`; names match case-insensitively. */
function eat(cursor: Cursor, value: string) {
  const token = peek(cursor);
  const matches =
    token &&
    ((token.kind === "op" && token.value === value) ||
      (token.kind === "name" && token.value.toLowerCase() === value));
  if (matches) {
    cursor.position += 1;
  }
  return Boolean(matches);
}

function expect(cursor: Cursor, value: string) {
  if (!eat(cursor, value)) {
    throw new FormulaError(`Expected ${value}`);
  }
}

function parseCall(cursor: Cursor, name: string): Node {
  const handler = functions[name];
  if (!handler) {
    throw new FormulaError(`Unknown function ${name}`);
  }
  expect(cursor, "(");
  const args: Node[] = [];
  if (!eat(cursor, ")")) {
    do {
      args.push(parseExpression(cursor, 0));
    } while (eat(cursor, ","));
    expect(cursor, ")");
  }
  return (lookup) => handler(args.map((argument) => argument(lookup)));
}

function parseName(cursor: Cursor, raw: string): Node {
  const name = raw.toLowerCase();
  if (name === "true" || name === "false") {
    return () => name === "true";
  }
  if (name === "null") {
    return () => null;
  }
  const next = peek(cursor);
  const isCall = next?.kind === "op" && next.value === "(";
  // `not {Done}` reads better than `not({Done})`, so the prefix form works too.
  if (name === "not" && !isCall) {
    const operand = parsePrimary(cursor);
    return (lookup) => !truthy(operand(lookup));
  }
  return parseCall(cursor, name);
}

function parsePrimary(cursor: Cursor): Node {
  const token = peek(cursor);
  if (!token) {
    throw new FormulaError("Unexpected end of formula");
  }
  cursor.position += 1;

  if (token.kind === "number" || token.kind === "string") {
    return () => token.value;
  }
  if (token.kind === "prop") {
    return (lookup) => lookup(token.value);
  }
  if (token.kind === "name") {
    return parseName(cursor, token.value);
  }
  if (token.value === "(") {
    const inner = parseExpression(cursor, 0);
    expect(cursor, ")");
    return inner;
  }
  if (token.value === "-") {
    const operand = parsePrimary(cursor);
    return (lookup) => -toNumber(operand(lookup));
  }
  throw new FormulaError(`Unexpected token ${String(token.value)}`);
}

/** Precedence climbing: everything binding tighter than `minimum` joins the left side. */
function parseExpression(cursor: Cursor, minimum: number): Node {
  let left = parsePrimary(cursor);
  for (;;) {
    const token = peek(cursor);
    const operator =
      token?.kind === "op"
        ? token.value
        : token?.kind === "name"
          ? token.value.toLowerCase()
          : "";
    const precedence = BINARY[operator];
    if (!precedence || precedence < minimum) {
      return left;
    }
    cursor.position += 1;
    const right = parseExpression(cursor, precedence + 1);
    const node = left;
    left = (lookup) => apply(operator, node(lookup), right(lookup));
  }
}

/** Compiles once; the returned function is what every row is run through. */
export function parseFormula(source: string) {
  const cursor: Cursor = { tokens: tokenize(source), position: 0 };
  const root = parseExpression(cursor, 0);
  if (cursor.position < cursor.tokens.length) {
    throw new FormulaError("Trailing input");
  }
  return root;
}

/** Parsing is per-source, evaluation is per-row, so compiled formulas are kept. */
const compiled = new Map<
  string,
  ((lookup: (name: string) => FormulaValue) => FormulaValue) | string
>();

/** Evaluates `source` against a cell lookup; a broken formula shows its error, not a crash. */
export function evaluateFormula(
  source: string,
  lookup: (name: string) => FormulaValue,
): FormulaValue {
  let entry = compiled.get(source);

  if (entry === undefined) {
    try {
      entry = parseFormula(source);
    } catch (error) {
      entry = `⚠ ${error instanceof Error ? error.message : String(error)}`;
    }
    compiled.set(source, entry);
  }

  if (typeof entry === "string") {
    return entry;
  }

  try {
    return entry(lookup);
  } catch (error) {
    return `⚠ ${error instanceof Error ? error.message : String(error)}`;
  }
}
