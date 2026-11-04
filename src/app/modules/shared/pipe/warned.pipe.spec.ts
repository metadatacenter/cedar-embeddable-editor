import { Injector, runInInjectionContext } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { FieldSeverity } from '../a11y/field-severity';
import { WarnedPipe } from './warned.pipe';

describe('a widget message marked as a warning', () => {
  const pipe = (severity: FieldSeverity | null): WarnedPipe => {
    const providers = [{ provide: TranslateService, useValue: { instant: () => 'Warning:' } }];
    const injector = Injector.create({
      providers: severity === null ? providers : [...providers, { provide: FieldSeverity, useValue: severity }],
    });
    return runInInjectionContext(injector, () => new WarnedPipe());
  };

  it('leads with the word while its field shows only warnings', () => {
    expect(pipe({ warningOnly: true }).transform('Value should be a valid URL.')).toBe(
      'Warning: Value should be a valid URL.',
    );
  });

  it('stands alone where its field shows an error', () => {
    expect(pipe({ warningOnly: false }).transform('Value should be a valid URL.')).toBe('Value should be a valid URL.');
  });

  it('stands alone outside a field presentation', () => {
    expect(pipe(null).transform('Value should be a valid URL.')).toBe('Value should be a valid URL.');
  });

  it('adds nothing to a message that is empty', () => {
    expect(pipe({ warningOnly: true }).transform('')).toBe('');
  });

  it('follows the field as its state changes', () => {
    const severity = { warningOnly: false };
    const warned = pipe(severity);
    expect(warned.transform('Too short.')).toBe('Too short.');
    severity.warningOnly = true;
    expect(warned.transform('Too short.')).toBe('Warning: Too short.');
  });
});
