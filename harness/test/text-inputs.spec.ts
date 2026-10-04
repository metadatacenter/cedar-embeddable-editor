/**
 * Every text box CEE renders carries `autocomplete="off"`.
 *
 * Without it, a browser lists beneath a text box what was once typed into any box with the same name
 * or id, on this site or another. Angular Material gives each `matInput` an id such as `mat-input-3`,
 * so the list beneath a CEDAR field can hold whatever someone typed into the third input of an
 * unrelated Material form. It also covers CEE's own term and value suggestions. The attribute holds
 * only by discipline, so this suite reads every template under `src/app`, the inline `template:`
 * strings included, and fails on a text box written without it.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP = path.resolve(__dirname, '../../src/app');

/** A browser never offers typed history for these input types. */
const NO_HISTORY = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'hidden',
  'button',
  'submit',
  'reset',
  'image',
]);

const walk = (dir: string): string[] =>
  fs.readdirSync(dir).flatMap((entry) => {
    const file = path.join(dir, entry);
    return fs.statSync(file).isDirectory() ? walk(file) : [file];
  });

/** Each `<input>` and `<textarea>` opening tag in `text`, with the line it starts on. */
function* textEntryTags(text: string): Generator<{ tag: string; line: number }> {
  for (const match of text.matchAll(/<(input|textarea)(?=[\s/>])/g)) {
    let quote: string | null = null;
    let end = match.index + match[0].length;
    for (; end < text.length; end++) {
      const character = text[end];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    const tag = text.slice(match.index, end + 1);
    const type = /\stype="([^"]*)"/.exec(tag)?.[1];
    if (match[1] === 'input' && type !== undefined && NO_HISTORY.has(type)) continue;
    yield { tag, line: text.slice(0, match.index).split('\n').length };
  }
}

describe('text boxes', () => {
  it('every text box carries autocomplete="off"', () => {
    const templates = walk(APP).filter(
      (file) => file.endsWith('.html') || (file.endsWith('.ts') && !file.endsWith('.spec.ts')),
    );
    const missing = templates.flatMap((file) =>
      [...textEntryTags(fs.readFileSync(file, 'utf8'))]
        .filter(({ tag }) => !/\sautocomplete="off"/.test(tag))
        .map(({ line }) => `${path.relative(APP, file)}:${line}`),
    );

    expect(templates.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
