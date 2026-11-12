import { DestroyRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SingleElementComponent } from '../../models/element/single-element-component.model';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { CedarComponentMarksComponent } from './cedar-component-marks.component';

/**
 * The marks that end a title row: the description, while editing, and the property IRI. Which of the
 * two are drawn decides the Tab stops a row gains, and for an element the room its header keeps.
 */
describe('CedarComponentMarksComponent', () => {
  const element = (description: string | null, propertyIri: string | null, language: string | null = null) => {
    const component = new SingleElementComponent();
    component.labelInfo.description = description;
    component.labelInfo.language = language;
    component.propertyIri = propertyIri;
    return component;
  };

  const makeMarks = (readOnly = false) => {
    const readOnlyMode = new BehaviorSubject(readOnly);
    const marks = new CedarComponentMarksComponent(
      { readOnlyMode$: readOnlyMode.asObservable() } as unknown as UserPreferencesService,
      { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef,
    );
    marks.ngOnInit();
    return { marks, readOnlyMode };
  };

  it('marks the description and the property IRI while the form is edited', () => {
    const { marks } = makeMarks();

    marks.componentToRender = element('What the element holds', 'https://example.org/properties/p');

    expect(marks.description).toBe('What the element holds');
    expect(marks.propertyIri).toBe('https://example.org/properties/p');
  });

  it('marks no description read-only, and still marks the property IRI', () => {
    const { marks, readOnlyMode } = makeMarks();
    marks.componentToRender = element('What the element holds', 'https://example.org/properties/p');

    readOnlyMode.next(true);

    expect(marks.description).toBeNull();
    expect(marks.propertyIri).toBe('https://example.org/properties/p');
  });

  it('marks neither where the template gives neither, an empty one included', () => {
    const { marks } = makeMarks();

    marks.componentToRender = element('', '');

    expect(marks.description).toBeNull();
    expect(marks.propertyIri).toBeNull();
  });

  it('states the language the template declares for the description', () => {
    const { marks } = makeMarks();

    marks.componentToRender = element('Ce que contient l’élément', null, 'fr');

    expect(marks.textLanguage).toBe('fr');
  });
});
