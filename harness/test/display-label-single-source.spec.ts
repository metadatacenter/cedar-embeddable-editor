/**
 * One place decides what a reader is shown, and one place names the Template Designer's
 * placeholder.
 *
 * Both rules had drifted. A read-only temporal field bound `labelInfo.label` into its
 * `aria-label`, so a field displayed as "Parent sample ID" was announced as
 * `parent_sample_id` — every other widget asks `ComponentDataService`. And `'Help Text'`
 * was written out in three places: the parser that filters it, the header that re-tested
 * it afterwards, and the field specification, whose comment explained that the header
 * already refused it.
 *
 * Neither is the kind of thing a behavioural test catches as it happens. A new widget that
 * binds the wrong property is a defect in a file that has no spec yet, and a fourth copy of
 * the placeholder is correct on the day it is written and wrong on the day the parser stops
 * treating that string as absent. So the invariant is asserted over the source, the way
 * `import-boundaries.spec.ts` asserts the domain layer stays framework-free.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '../../src/app');

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const files = walk(SRC);
const templates = files.filter((f) => f.endsWith('.html'));
const sources = files.filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
const relative = (f: string) => path.relative(SRC, f);

describe('the label a reader is shown', () => {
  it('there are templates to check', () => {
    expect(templates.length).toBeGreaterThan(20);
  });

  /**
   * A template holds no parent, so no parent can override its name and the chain has nothing
   * to resolve. It is the one component that reads `schema:name` and displays it.
   */
  const TEMPLATE_OWN_NAME = /templateRepresentation\?\.labelInfo\?\.label/;

  it('is never taken from schema:name directly, except by the template itself', () => {
    const offenders = templates
      .filter((f) => {
        const text = fs.readFileSync(f, 'utf8');
        return /labelInfo\??\.label\b/.test(text.replace(TEMPLATE_OWN_NAME, ''));
      })
      .map(relative);

    expect(
      offenders,
      'a template bound labelInfo.label rather than asking ComponentDataService for the name to show',
    ).toEqual([]);
  });
});

describe("the Template Designer's placeholder for a description nobody wrote", () => {
  const PARSER = 'modules/shared/factory/model-library-template-parser.ts';

  it('is named in one file, which is the one that treats it as absent', () => {
    const naming = [...sources, ...templates].filter((f) => fs.readFileSync(f, 'utf8').includes('Help Text')).map(relative);

    expect(naming, 'the placeholder is spelled out somewhere that does not decide what it means').toEqual([PARSER]);
  });
});
