// @vitest-environment jsdom
import { ElementRef } from '@angular/core';
import { CedarFieldPresentationComponent } from './cedar-field-presentation.component';

describe('field pager placement', () => {
  it('leaves a settled field without a pager untouched on subsequent view checks', () => {
    const host = document.createElement('div');
    host.className = 'child-component';
    const component = new CedarFieldPresentationComponent(new ElementRef(host));
    const observer = new MutationObserver(() => {});
    observer.observe(host, { attributes: true });

    component.ngAfterViewChecked();
    component.ngAfterViewChecked();

    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
    component.ngOnDestroy();
  });

  it('clears obsolete stacking once when a pager disappears', () => {
    const host = document.createElement('div');
    host.classList.add('stacked-editable-pager');
    const component = new CedarFieldPresentationComponent(new ElementRef(host));
    component.ngAfterViewChecked();
    expect(host.classList.contains('stacked-editable-pager')).toBe(false);
    const observer = new MutationObserver(() => {});
    observer.observe(host, { attributes: true });

    component.ngAfterViewChecked();

    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
    component.ngOnDestroy();
  });
});
