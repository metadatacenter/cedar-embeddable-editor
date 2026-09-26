/**
 * No user-visible English written into the source.
 *
 * `translations.spec.ts` checks that the two language files agree with each other. It cannot see a
 * sentence that never reached them: an `aria-label` typed into a template, or an error message a
 * handler returns as a string. Such text reaches every user in English whatever language CEE was
 * configured with, and nothing failed when it was added. This suite scans the source for it.
 *
 * Three kinds of text are examined.
 *
 * - Template text. Every `.html` template under `src/app`, and every inline `template:` string in a
 *   `.ts` file, is read as markup. A text node is flagged when it still holds a letter after its
 *   `{{ … }}` interpolations, its Angular control flow (`@if (…) {`, `}`), its HTML comments and its
 *   entities (`&nbsp;`, `&times;`) are removed.
 * - Template attributes. A static value of one of `TEXT_ATTRIBUTES`, or of its `attr.` form, is
 *   flagged when it holds a letter outside an interpolation. A bound attribute (`[placeholder]`) and a
 *   value that is entirely an interpolation, which is how the `translate` pipe is used, pass.
 * - TypeScript string literals that reach a user-facing sink. The sinks CEE has are listed in
 *   `SINK_PROPERTIES` and `SINK_MEMBER`, with the rule for each beside it. A literal that is a key in
 *   `en.json` is a translation key, not text, and passes.
 *
 * Some English stays in English deliberately, and `EXCLUDED_FILES` and `DIAGNOSTIC_CALLS` say which.
 * Anything else that must stay as written, such as a product name or a symbol, is listed in
 * `harness/i18n-allowlist.json` with its reason. The suite fails on a finding the list does not name,
 * and on an entry that no longer matches anything, so the list cannot outlive the text it excuses.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '../..');
const APP = path.join(ROOT, 'src/app');
const ALLOWLIST = path.resolve(__dirname, '../i18n-allowlist.json');

/** Attributes whose static value a user reads or hears. Compared case-insensitively. */
const TEXT_ATTRIBUTES = new Set(
  [
    'aria-label',
    'aria-description',
    'aria-placeholder',
    'aria-roledescription',
    'title',
    'placeholder',
    'alt',
    'label',
    'matTooltip',
  ].map((name) => name.toLowerCase()),
);

/**
 * Object properties whose string value CEE puts on screen. A static image or video view carries its
 * explanation in `error`, which the component renders as an alert, so `error` is a sink here too.
 */
const SINK_PROPERTIES = new Set([
  'label',
  'title',
  'message',
  'placeholder',
  'ariaLabel',
  'summary',
  'tooltip',
  'description',
  'error',
]);

/**
 * Class members and functions whose value a template binds as text, identified by the end of their
 * name: `videoTitle`, `dateNotation`, `attributeNameError`, `validationMessage`. A literal returned
 * from one, assigned to one, or used as its initial value is a sink. So is a sentence anywhere in a
 * function declared to return `Translatable`, since a translatable message must carry a key. A
 * single word there is a fragment of a key the function assembles, such as `Float` in
 * `Validation.Numeric.Type.Float`, so only text holding a space or punctuation other than a period
 * is flagged.
 */
const SINK_MEMBER = /(label|title|message|placeholder|arialabel|summary|tooltip|description|error|notation)$/i;

/**
 * Files whose English is deliberate.
 *
 * The data quality report's diagnostics are `ValidationProblem` messages, which hosts read as data
 * next to their codes; `ValidationProblem` documents why they stay in English. The RDF export's
 * errors go to the host's error channel, like the diagnostic calls below. The development shell is
 * the page `ng serve` shows around the editor; it is not part of the published component.
 */
const EXCLUDED_FILES = new Set([
  'src/app/app.component.dev.html',
  'src/app/app.component.dev.ts',
  'src/app/modules/shared/validation/field-value-validator.ts',
  'src/app/modules/shared/handler/data-quality-report-builder.handler.ts',
  'src/app/modules/shared/util/rdf-export.ts',
]);

/**
 * Calls whose argument is a developer diagnostic, reported to the host's console or error channel
 * rather than shown in the form. A literal anywhere inside such a call is never a finding.
 */
const DIAGNOSTIC_CALLS = new Set(['error', 'trace', 'traceObject', 'traceGroup']);

const LETTER = /\p{L}/u;

interface Finding {
  file: string;
  line: number;
  kind: string;
  text: string;
}

interface AllowEntry {
  file: string;
  text: string;
  reason: string;
}

const flattenKeys = (node: Record<string, unknown>, prefix = '', out = new Set<string>()): Set<string> => {
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === 'object') {
      flattenKeys(value as Record<string, unknown>, `${prefix}${key}.`, out);
    } else {
      out.add(`${prefix}${key}`);
    }
  }
  return out;
};
const KEYS = flattenKeys(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/assets/i18n-cee/en.json'), 'utf8')));
/** A key, or the start of one that the code completes (`'Spec.Notation.' + granularity`). */
const isTranslationKey = (text: string): boolean =>
  KEYS.has(text) || (text.includes('.') && [...KEYS].some((key) => key.startsWith(text)));
/** Text that could be a key or a fragment of one: a single word, or words joined by periods. */
const KEY_SHAPED = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]*)*$/;

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();
const lineAt = (source: string, offset: number): number => source.slice(0, offset).split('\n').length;
/** Blank a span while keeping its newlines, so later offsets still map to the right line. */
const blank = (text: string): string => text.replace(/[^\n]/g, ' ');

const CONTROL_BLOCKS = new Set([
  'if',
  'else',
  'for',
  'switch',
  'case',
  'default',
  'empty',
  'defer',
  'placeholder',
  'loading',
  'error',
]);

/** Remove Angular's `@if (…) {` / `@let x = …;` syntax and the braces that close its blocks. */
const stripControlFlow = (text: string): string => {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const match = /^@([A-Za-z]+)/.exec(text.slice(i));
    if (match && (CONTROL_BLOCKS.has(match[1]) || match[1] === 'let')) {
      let j = i + match[0].length;
      if (match[1] === 'let') {
        j = text.indexOf(';', j) + 1 || text.length;
      } else {
        // `@else if (…)`
        const elseIf = /^\s+if\b/.exec(text.slice(j));
        if (match[1] === 'else' && elseIf) {
          j += elseIf[0].length;
        }
        const open = /^\s*\(/.exec(text.slice(j));
        if (open) {
          j += open[0].length;
          let depth = 1;
          while (j < text.length && depth > 0) {
            depth += text[j] === '(' ? 1 : text[j] === ')' ? -1 : 0;
            j++;
          }
        }
      }
      out += blank(text.slice(i, j));
      i = j;
    } else {
      out += text[i] === '{' || text[i] === '}' ? ' ' : text[i];
      i++;
    }
  }
  return out;
};

const stripInterpolations = (text: string): string => text.replace(/\{\{[\s\S]*?\}\}/g, blank);
const stripEntities = (text: string): string => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, ' ');

/** The findings in one piece of Angular template markup. */
const scanMarkup = (file: string, markup: string, firstLine = 1): Finding[] => {
  const findings: Finding[] = [];
  const source = markup.replace(/<!--[\s\S]*?-->/g, blank);
  const report = (offset: number, kind: string, text: string): void => {
    findings.push({ file, line: firstLine - 1 + lineAt(source, offset), kind, text: normalize(text) });
  };
  const checkText = (offset: number, raw: string): void => {
    const text = stripEntities(stripControlFlow(stripInterpolations(raw)));
    if (LETTER.test(text)) {
      report(offset, 'text', text);
    }
  };

  let i = 0;
  let textStart = 0;
  while (i < source.length) {
    if (source[i] === '<' && /[A-Za-z/]/.test(source[i + 1] ?? '')) {
      checkText(textStart, source.slice(textStart, i));
      // Find the tag's end, stepping over quoted attribute values, which may hold `>`.
      let j = i + 1;
      let quote: string | null = null;
      while (j < source.length && (quote !== null || source[j] !== '>')) {
        if (quote === null && (source[j] === '"' || source[j] === "'")) {
          quote = source[j];
        } else if (quote !== null && source[j] === quote) {
          quote = null;
        }
        j++;
      }
      const tag = source.slice(i + 1, j);
      const attribute = /([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
      // Skip the element name.
      const name = /^\/?[^\s/>]+/.exec(tag);
      attribute.lastIndex = name ? name[0].length : 0;
      for (let m = attribute.exec(tag); m !== null; m = attribute.exec(tag)) {
        const attributeName = m[1].replace(/^attr\./, '').toLowerCase();
        if (m[2] === undefined || !TEXT_ATTRIBUTES.has(attributeName)) {
          continue;
        }
        const value = m[2].replace(/^["']|["']$/g, '');
        if (LETTER.test(stripInterpolations(value))) {
          report(i + 1 + m.index, `attribute ${m[1]}`, value);
        }
      }
      i = j + 1;
      textStart = i;
    } else {
      i++;
    }
  }
  checkText(textStart, source.slice(textStart));
  return findings;
};

/** The text of a string literal or template literal, with `${…}` substitutions left out. */
const literalText = (node: ts.Node): string | null => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
  }
  return null;
};

const nameOf = (node: ts.Node | undefined): string | null =>
  node !== undefined && (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isPrivateIdentifier(node))
    ? node.text
    : null;

/** The function a node sits in, with the name it is known by and its declared return type. */
const enclosingFunction = (node: ts.Node): { name: string | null; returnType: string } | null => {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isFunctionLike(current)) {
      const declared = current.type?.getText() ?? '';
      let name = nameOf((current as ts.FunctionLikeDeclaration).name);
      if (name === null && (ts.isArrowFunction(current) || ts.isFunctionExpression(current))) {
        const holder = current.parent;
        if (ts.isVariableDeclaration(holder) || ts.isPropertyDeclaration(holder) || ts.isPropertyAssignment(holder)) {
          name = nameOf(holder.name);
        }
      }
      return { name, returnType: declared };
    }
  }
  return null;
};

const insideDiagnosticCall = (node: ts.Node): boolean => {
  for (let current = node.parent; current !== undefined; current = current.parent) {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const method = current.expression.name.text;
      if (DIAGNOSTIC_CALLS.has(method) && /message/i.test(current.expression.expression.getText())) {
        return true;
      }
    }
  }
  return false;
};

const COMBINING_OPERATORS = new Set([
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.PlusToken,
]);

/** Which sink a literal reaches, or null when it reaches none. */
const sinkOf = (literal: ts.Node): string | null => {
  let node: ts.Node = literal;
  let parent = node.parent;
  // Climb through the expressions that pass a string along unchanged or combine it with others.
  // A comparison (`language === 'hu'`) or a condition consumes the string rather than passing it on.
  const passesAlong = (outer: ts.Node, inner: ts.Node): boolean =>
    ts.isParenthesizedExpression(outer) ||
    ts.isAsExpression(outer) ||
    ts.isTemplateSpan(outer) ||
    ts.isTemplateExpression(outer) ||
    (ts.isConditionalExpression(outer) && outer.condition !== inner) ||
    (ts.isBinaryExpression(outer) && COMBINING_OPERATORS.has(outer.operatorToken.kind));
  while (passesAlong(parent, node)) {
    node = parent;
    parent = node.parent;
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    const name = nameOf(parent.name);
    if (name !== null && SINK_PROPERTIES.has(name)) {
      return `property ${name}`;
    }
  }
  if (ts.isPropertyDeclaration(parent) && parent.initializer === node) {
    const name = nameOf(parent.name);
    if (name !== null && SINK_MEMBER.test(name)) {
      return `initial value of ${name}`;
    }
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    parent.right === node &&
    ts.isPropertyAccessExpression(parent.left) &&
    SINK_MEMBER.test(parent.left.name.text)
  ) {
    return `assignment to ${parent.left.name.text}`;
  }
  const returned = ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === node);
  const fn = enclosingFunction(literal);
  if (
    fn !== null &&
    /\bTranslatable\b/.test(fn.returnType) &&
    !KEY_SHAPED.test(normalize(literalText(literal) ?? ''))
  ) {
    return `inside ${fn.name ?? 'a function'} returning Translatable`;
  }
  if (returned && fn?.name && SINK_MEMBER.test(fn.name)) {
    return `returned from ${fn.name}`;
  }
  return null;
};

const scanTypeScript = (file: string, text: string): Finding[] => {
  const findings: Finding[] = [];
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const line = (node: ts.Node): number => sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      nameOf(node.name) === 'template' &&
      literalText(node.initializer) !== null &&
      ts.isObjectLiteralExpression(node.parent) &&
      ts.isCallExpression(node.parent.parent) &&
      node.parent.parent.expression.getText() === 'Component'
    ) {
      findings.push(...scanMarkup(file, literalText(node.initializer) ?? '', line(node.initializer)));
      return;
    }
    const content = literalText(node);
    if (content !== null) {
      if (LETTER.test(content) && !isTranslationKey(normalize(content)) && !insideDiagnosticCall(node)) {
        const sink = sinkOf(node);
        if (sink !== null) {
          findings.push({ file, line: line(node), kind: sink, text: normalize(content) });
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return /fixtures?$/.test(entry.name) ? [] : walk(full);
    }
    return /\.spec\.ts$/.test(entry.name) ? [] : [full];
  });

const scanAll = (): Finding[] =>
  walk(APP).flatMap((full) => {
    const file = path.relative(ROOT, full).split(path.sep).join('/');
    if (EXCLUDED_FILES.has(file)) {
      return [];
    }
    if (file.endsWith('.html')) {
      return scanMarkup(file, fs.readFileSync(full, 'utf8'));
    }
    return file.endsWith('.ts') ? scanTypeScript(file, fs.readFileSync(full, 'utf8')) : [];
  });

const allowlist: AllowEntry[] = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
const allows = (entry: AllowEntry, finding: Finding): boolean =>
  entry.file === finding.file && entry.text === finding.text;
const describeFinding = (finding: Finding): string =>
  `${finding.file}:${finding.line} (${finding.kind}) ${JSON.stringify(finding.text)}`;

describe('user-visible text', () => {
  const findings = scanAll();

  it('goes through the language files', () => {
    const unlisted = findings.filter((finding) => !allowlist.some((entry) => allows(entry, finding)));
    expect(
      unlisted.map(describeFinding),
      'add a key to en.json and hu.json, or list the text in harness/i18n-allowlist.json with its reason',
    ).toEqual([]);
  });

  it('has an allow-list whose every entry still excuses something and says why', () => {
    const stale = allowlist.filter((entry) => !findings.some((finding) => allows(entry, finding)));
    expect(stale, 'remove allow-list entries that no longer match a finding').toEqual([]);
    expect(allowlist.filter((entry) => !entry.reason?.trim())).toEqual([]);
  });

  /** The scanner itself, on markup small enough to read, so a green run means it looked. */
  it('flags literal text and attributes, and passes translated and bound ones', () => {
    const markup = [
      '<!-- A comment is not text. -->',
      '@if (ready) {',
      '  <span aria-label="Plain words">{{ "Generic.Clear" | translate }}</span>',
      '  <input [placeholder]="notation" attr.aria-label="{{ \'Generic.Time\' | translate }}" />',
      '  <b>Visible</b>&nbsp;&times; {{ count }}',
      '} @else {',
      '  <i matTooltip="Tip">·</i>',
      '}',
    ].join('\n');
    expect(scanMarkup('x.html', markup).map(({ line, kind, text }) => [line, kind, text])).toEqual([
      [3, 'attribute aria-label', 'Plain words'],
      [5, 'text', 'Visible'],
      [7, 'attribute matTooltip', 'Tip'],
    ]);
  });

  it('flags literals only where they reach a sink', () => {
    const source = [
      "import { Translatable } from './translatable.model';",
      'class View {',
      "  videoTitle = 'Untitled';",
      "  mode = 'hour';",
      '  get dateNotation(): string {',
      "    return this.flag ? 'YYYY' : 'Spec.Notation.day';",
      '  }',
      '  check(): Translatable | null {',
      "    return { key: 'Generic.Clear', params: { unit: 'Float', name: 'A sentence.' } };",
      '  }',
      '  report(): void {',
      "    this.messageHandlerService.error({ message: 'For the console' });",
      '    const shown = { error: `Cannot load ${this.url}` };',
      '  }',
      '}',
    ].join('\n');
    expect(scanTypeScript('x.ts', source).map(({ line, text }) => [line, text])).toEqual([
      [3, 'Untitled'],
      [6, 'YYYY'],
      [9, 'A sentence.'],
      [13, 'Cannot load'],
    ]);
  });
});
