/**
 * The domain layer does not reach up into the Angular layer.
 *
 * `shared/handler`, `shared/util`, `shared/factory`, `shared/validation` and
 * `shared/models` are plain TypeScript. That is what lets this harness test the
 * real production code with no framework, and what should let the domain survive
 * the Angular upgrade untouched.
 *
 * One import broke it: `DataObjectUtil.getIriPrefix()` read a single static off
 * `CedarEmbeddableMetadataEditorComponent`, which dragged the whole component
 * subtree in behind it — HttpClient lookup services, a `package.json` import,
 * and an edge back into `DataObjectUtil` itself. A real cycle, surviving only
 * because webpack tolerates one, and it cost this harness a stub of the entire
 * editor component to cut.
 *
 * The value now lives in `util/iri-prefix.ts`, which imports nothing. This test
 * is here because that is a property worth keeping rather than a one-off fix: a
 * single convenient `import` would put it back, and nothing else would complain
 * until the framework moved.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SHARED = path.resolve(__dirname, '../../src/app/modules/shared');

/** The directories that must stay framework-free. */
const DOMAIN_DIRS = ['handler', 'util', 'factory', 'validation', 'models'];

const walk = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
};

const domainFiles = DOMAIN_DIRS.flatMap((d) => walk(path.join(SHARED, d)));

const importsOf = (file: string): string[] => {
  const source = fs.readFileSync(file, 'utf8');
  const found: string[] = [];
  // `import ... from '<x>'` and `import '<x>'`, single or double quoted.
  for (const match of source.matchAll(/(?:^|\n)\s*import\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) {
    found.push(match[1]);
  }
  return found;
};

const relative = (file: string) => path.relative(SHARED, file);

describe('the domain layer is framework-free', () => {
  it('there are domain files to check', () => {
    expect(domainFiles.length).toBeGreaterThan(40);
  });

  /**
   * The specific regression. Named on its own because it is the import that
   * actually existed, and the message should say what to do rather than just
   * that a rule was broken.
   */
  it.each(domainFiles.map((f) => [relative(f), f] as const))(
    '%s does not import the editor component',
    (name, file) => {
      const offending = importsOf(file).filter((i) => /cedar-embeddable-metadata-editor(\.component)?$/.test(i));
      expect(
        offending,
        `${name} imports the top-level editor component, which drags the Angular subtree into the domain layer. ` +
          'If you need a config value, put it in a module of its own — see util/iri-prefix.ts.',
      ).toEqual([]);
    },
  );

  /**
   * The domain layer's Angular touchpoints, all six of them, and why.
   *
   * "Framework-free" is not literally true and it would be dishonest to assert
   * it. What is true is that these six imports cost nothing at runtime here:
   * three are types or decorators the harness's `@angular/core` stub satisfies,
   * and two are the translate loader, which no domain code calls.
   *
   * Listed rather than allowed by pattern so a *new* one has to be added
   * deliberately, with a reason. That is the actual property worth protecting —
   * the number going up quietly is how a domain layer stops being portable.
   */
  const KNOWN_ANGULAR_IMPORTS: Record<string, string> = {
    'handler/multi-instance-object.handler.ts': '@Injectable only; the class is constructed with new',
    'util/authority-search-control.ts': 'AbstractControl as a type, so widgets can pass their FormControl',
    'util/fallback-translate-loader-factory.ts': 'HttpClient; i18n wiring, never called by domain code',
    'util/fallback-translate-loader.ts': 'HttpClient; i18n wiring, never called by domain code',
    'validation/cedar-validators.ts': 'ValidatorFn and friends — this file *is* the Angular adapter',
    'models/ui/cedar-ui-component.model.ts': 'the base @Directive every widget extends',
  };

  it.each(domainFiles.map((f) => [relative(f), f] as const))('%s: Angular imports are accounted for', (name, file) => {
    const angular = importsOf(file).filter((i) => i.startsWith('@angular/'));
    if (angular.length === 0) {
      return;
    }
    expect(
      KNOWN_ANGULAR_IMPORTS[name],
      `${name} imports ${angular.join(', ')}. If that is deliberate, add it to KNOWN_ANGULAR_IMPORTS with the ` +
        'reason; if not, the domain layer should not be reaching for the framework.',
    ).toBeTruthy();
  });

  it('no accounted-for Angular import has since been removed', () => {
    const stillImporting = domainFiles
      .filter((f) => importsOf(f).some((i) => i.startsWith('@angular/')))
      .map(relative)
      .sort();
    expect(stillImporting).toEqual(Object.keys(KNOWN_ANGULAR_IMPORTS).sort());
  });

  /**
   * `components/` and `service/` are the Angular layer and may import what they
   * like; this only pins the direction of the dependency. Stated as a test so
   * the list above cannot be quietly narrowed to make a failure go away.
   */
  it('checks every domain directory that exists', () => {
    for (const dir of DOMAIN_DIRS) {
      expect(fs.existsSync(path.join(SHARED, dir)), `${dir} is missing — has it been renamed?`).toBe(true);
    }
  });
});

describe('the iri prefix holder', () => {
  /**
   * It exists to be importable from anywhere, which it only is if it imports
   * nothing itself.
   */
  it('imports nothing at all', () => {
    expect(importsOf(path.join(SHARED, 'util/iri-prefix.ts'))).toEqual([]);
  });
});
