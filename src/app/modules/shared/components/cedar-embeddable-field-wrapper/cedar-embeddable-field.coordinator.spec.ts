/**
 * The `cedar-embeddable-field` element, compiled and driven.
 *
 * Here rather than beside the unit specs because there is nothing to assert about this
 * component that does not involve the widget it renders: whether a control appeared,
 * whether typing into it reaches the host, whether read-only shows a value or a
 * statement of what the field will accept. All of that needs the real templates, which
 * is what this suite compiles.
 *
 * The field artifacts are built with the model library rather than pasted as JSON, for
 * the reason the harness builds its templates that way: an artifact written by the
 * library is one a host could actually produce.
 */
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';
import {
  BiboStatus,
  CedarBuilders,
  CedarWriters,
  SchemaVersion,
  TemplateField,
  TemporalGranularity,
  TemporalType,
  TextFieldBuilder,
} from 'cedar-model-typescript-library';
import type { CedarEmbeddableFieldChangeDetail, CeeJsonObject } from '../../../../cee-public-api';
import { SharedModule } from '../../shared.module';
import { CedarEmbeddableFieldWrapperComponent } from './cedar-embeddable-field-wrapper.component';
import { CedarSpecBoxComponent } from '../cedar-spec-box/cedar-spec-box.component';

/** A field as a host holds one: written by the library, round-tripped through JSON. */
const artifactOf = (field: TemplateField): CeeJsonObject =>
  JSON.parse(
    JSON.stringify(CedarWriters.json().getStrict().getFieldWriterForField(field).getAsJsonNode(field)),
  ) as CeeJsonObject;

const textArtifact = (
  configure: (builder: TextFieldBuilder) => TextFieldBuilder = (builder) => builder,
): CeeJsonObject =>
  artifactOf(
    configure(
      CedarBuilders.textFieldBuilder()
        .withTitle('Sample')
        .withDescription('A sample field')
        .withSchemaName('Sample')
        .withSchemaVersion(SchemaVersion.CURRENT)
        .withStatus(BiboStatus.DRAFT),
    ).build(),
  );

const temporalArtifact = (): CeeJsonObject =>
  artifactOf(
    CedarBuilders.temporalFieldBuilder()
      .withTitle('When')
      .withDescription('A sample date')
      .withSchemaName('When')
      .withTemporalType(TemporalType.DATE)
      .withTemporalGranularity(TemporalGranularity.DAY)
      .build(),
  );

const richTextArtifact = (): CeeJsonObject =>
  artifactOf(
    CedarBuilders.richTextFieldBuilder()
      .withTitle('Notice')
      .withDescription('A sample notice')
      .withSchemaName('Notice')
      .withContent('<p>Read this</p>')
      .build(),
  );

const pageBreakArtifact = (): CeeJsonObject =>
  artifactOf(
    CedarBuilders.pageBreakFieldBuilder()
      .withTitle('Next')
      .withDescription('A page break')
      .withSchemaName('Next')
      .build(),
  );

interface Mounted {
  fixture: ReturnType<typeof TestBed.createComponent<CedarEmbeddableFieldWrapperComponent>>;
  element: CedarEmbeddableFieldWrapperComponent;
  changes: CedarEmbeddableFieldChangeDetail[];
  errors: ReturnType<typeof vi.fn>;
}

const mount = async (field: CeeJsonObject | null, config: object = {}): Promise<Mounted> => {
  await TestBed.configureTestingModule({
    imports: [SharedModule],
    providers: [provideHttpClient(), provideTranslateService()],
  }).compileComponents();

  const fixture = TestBed.createComponent(CedarEmbeddableFieldWrapperComponent);
  const changes: CedarEmbeddableFieldChangeDetail[] = [];
  const errors = vi.fn();
  fixture.nativeElement.addEventListener('valueChange', (event: Event) =>
    changes.push((event as CustomEvent<CedarEmbeddableFieldChangeDetail>).detail),
  );
  fixture.componentInstance.eventHandler = { error: errors };
  fixture.componentInstance.config = config;
  fixture.componentInstance.fieldObject = field;

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, element: fixture.componentInstance, changes, errors };
};

const inputIn = (mounted: Mounted): HTMLInputElement =>
  mounted.fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;

const type = async (mounted: Mounted, text: string): Promise<void> => {
  const input = inputIn(mounted);
  input.value = text;
  input.dispatchEvent(new Event('input'));
  mounted.fixture.detectChanges();
  await mounted.fixture.whenStable();
};

describe('acquiring a value', () => {
  it('renders the control the field type calls for', async () => {
    const mounted = await mount(textArtifact());

    expect(mounted.fixture.debugElement.query(By.css('input'))).not.toBeNull();
    expect(mounted.errors).not.toHaveBeenCalled();
  });

  it('reports what was typed, in the kind the field is written in', async () => {
    const mounted = await mount(textArtifact());

    await type(mounted, 'a typed answer');

    expect(mounted.changes).toEqual([{ value: { kind: 'literal', value: 'a typed answer' }, valid: true }]);
    expect(mounted.element.currentValue).toEqual({ kind: 'literal', value: 'a typed answer' });
  });

  it('reports an emptied field as holding nothing', async () => {
    const mounted = await mount(textArtifact());

    await type(mounted, 'something');
    await type(mounted, '');

    expect(mounted.changes.at(-1)).toEqual({ value: { kind: 'none' }, valid: true });
  });

  /** A value the host put there is not news to the host. */
  it('does not announce a value the host assigned', async () => {
    const mounted = await mount(textArtifact());

    mounted.element.value = { kind: 'literal', value: 'assigned' };
    mounted.fixture.detectChanges();
    await mounted.fixture.whenStable();

    expect(mounted.changes).toEqual([]);
    expect(inputIn(mounted).value).toBe('assigned');
  });

  it('shows the default the field itself declares', async () => {
    const mounted = await mount(textArtifact((builder) => builder.withDefaultValue('declared')));

    expect(inputIn(mounted).value).toBe('declared');
    expect(mounted.element.currentValue).toEqual({ kind: 'literal', value: 'declared' });
  });

  it('refuses a value of a kind the field cannot hold, and says which it takes', async () => {
    const mounted = await mount(temporalArtifact());

    mounted.element.value = { kind: 'literal', value: 'not a date' };

    expect(mounted.errors).toHaveBeenCalledWith(expect.stringContaining('"temporal"'), null);
  });
});

describe('presenting a value', () => {
  /**
   * Read-only with nothing in it states what the field will accept, which is what the
   * editor shows for a template nobody has filled in. The widget is replaced rather
   * than annotated, so the box is the assertion.
   */
  it('states the specification when there is nothing to show', async () => {
    const mounted = await mount(textArtifact(), { readOnlyMode: true });

    expect(mounted.fixture.debugElement.query(By.directive(CedarSpecBoxComponent))).not.toBeNull();
  });

  it('shows the value when there is one', async () => {
    const mounted = await mount(textArtifact(), { readOnlyMode: true });

    mounted.element.value = { kind: 'literal', value: 'recorded' };
    mounted.fixture.detectChanges();
    await mounted.fixture.whenStable();
    mounted.fixture.detectChanges();

    expect(mounted.fixture.debugElement.query(By.directive(CedarSpecBoxComponent))).toBeNull();
    expect(inputIn(mounted).value).toBe('recorded');
  });

  it('renders a static field, which has a value to show and none to give', async () => {
    const mounted = await mount(richTextArtifact());

    // The element renders into a shadow root, so its own `textContent` is empty; the
    // debug tree crosses the boundary the DOM does not.
    expect(
      mounted.fixture.debugElement.query(By.css('.cedar-embeddable-field-root')).nativeElement.textContent,
    ).toContain('Read this');
    expect(mounted.element.currentValue).toEqual({ kind: 'none' });
    expect(mounted.errors).not.toHaveBeenCalled();
  });
});

describe('an artifact the element cannot render', () => {
  it('is reported, rather than leaving a blank element', async () => {
    const mounted = await mount({ '@type': 'https://example.org/not-a-field' } as CeeJsonObject);

    expect(mounted.errors).toHaveBeenCalled();
    expect(mounted.fixture.debugElement.query(By.css('input'))).toBeNull();
  });

  it('leaves the field already on screen standing', async () => {
    const mounted = await mount(textArtifact((builder) => builder.withDefaultValue('first')));

    mounted.element.fieldObject = { '@type': 'https://example.org/not-a-field' } as CeeJsonObject;
    mounted.fixture.detectChanges();

    expect(inputIn(mounted).value).toBe('first');
  });

  it('is a page break, which divides a form this element does not have', async () => {
    const mounted = await mount(pageBreakArtifact());

    expect(mounted.errors).toHaveBeenCalledWith(expect.stringContaining('page break'), null);
  });
});

describe('replacing a field and tracking validity', () => {
  it('updates the live validators after replacing a field of the same type', async () => {
    const mounted = await mount(textArtifact((builder) => builder.withMaxLength(3)));
    mounted.element.fieldObject = textArtifact((builder) => builder.withMaxLength(10));
    mounted.fixture.detectChanges();
    await mounted.fixture.whenStable();
    await type(mounted, 'abcdef');
    const widget = mounted.fixture.debugElement.query(By.css('app-cedar-input-text')).componentInstance;
    expect(mounted.element.currentValueValid).toBe(true);
    expect(widget.inputValueControl.valid).toBe(true);
    expect(widget.constraintMaxLength).toBe(10);
  });

  it('publishes a numeric validity change even when its normalized number is unchanged', async () => {
    const field = artifactOf(
      CedarBuilders.numericFieldBuilder()
        .withTitle('Number')
        .withDescription('Number')
        .withSchemaName('Number')
        .withDecimalPlaces(1)
        .build(),
    );
    const mounted = await mount(field);
    await type(mounted, '1.5');
    expect(mounted.element.currentValueValid).toBe(true);
    await type(mounted, '1.50');
    expect(mounted.element.currentValueValid).toBe(false);
    expect(mounted.changes.at(-1)).toEqual({ value: { kind: 'number', value: 1.5 }, valid: false });
    await type(mounted, '1.5');
    expect(mounted.element.currentValueValid).toBe(true);
    expect(mounted.changes).toEqual([
      { value: { kind: 'number', value: 1.5 }, valid: true },
      { value: { kind: 'number', value: 1.5 }, valid: false },
      { value: { kind: 'number', value: 1.5 }, valid: true },
    ]);
    await type(mounted, '1.5');
    expect(mounted.changes).toHaveLength(3);
  });
});

describe('rejected assignments', () => {
  const numeric = () =>
    artifactOf(CedarBuilders.numericFieldBuilder().withSchemaName('Number').withDefaultValue(7).build());

  it('does not replay a rejected number when text is replaced by a numeric field', async () => {
    const mounted = await mount(textArtifact(), { readOnlyMode: true });
    mounted.element.value = { kind: 'number', value: 99 };
    mounted.fixture.detectChanges();
    expect(mounted.element.handlerContext.instanceSupplied).toBe(false);
    expect(mounted.fixture.debugElement.query(By.directive(CedarSpecBoxComponent))).not.toBeNull();
    mounted.element.fieldObject = numeric();
    expect(mounted.element.currentValue).toEqual({ kind: 'number', value: 7 });
    expect(mounted.errors).toHaveBeenCalledTimes(1);
    expect(mounted.changes).toEqual([]);
  });

  it('keeps the last accepted assignment after rejecting another', async () => {
    const mounted = await mount(textArtifact());
    mounted.element.value = { kind: 'literal', value: 'accepted' };
    mounted.element.value = { kind: 'number', value: 99 };
    mounted.element.fieldObject = textArtifact();
    expect(mounted.element.currentValue).toEqual({ kind: 'literal', value: 'accepted' });
    expect(mounted.changes).toEqual([]);
  });

  it('accepts a value before the field arrives', async () => {
    const mounted = await mount(null);
    mounted.element.value = { kind: 'number', value: 99 };
    mounted.element.fieldObject = numeric();
    expect(mounted.element.currentValue).toEqual({ kind: 'number', value: 99 });
    expect(mounted.errors).not.toHaveBeenCalled();
  });

  it('discards a pending assignment rejected by the first field', async () => {
    const mounted = await mount(null);
    mounted.element.value = { kind: 'number', value: 99 };
    mounted.element.fieldObject = textArtifact();
    mounted.element.fieldObject = numeric();
    expect(mounted.element.currentValue).toEqual({ kind: 'number', value: 7 });
    expect(mounted.errors).toHaveBeenCalledTimes(1);
  });
});
