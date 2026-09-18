import { Injector, runInInjectionContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIcon, MatIconRegistry } from '@angular/material/icon';
import { getIcon, iconNames, iconSvg } from '@org.metadatacenter/cedar-design-tokens/icons';
import { CedarIconDirective } from './cedar-icon.directive';

describe('CedarIconDirective', () => {
  it('registers every shared meaning and updates the Material host', () => {
    const register = vi.fn();
    const trust = vi.fn((svg: string) => svg);
    const host = { svgIcon: '' };
    const injector = Injector.create({
      providers: [
        { provide: MatIcon, useValue: host },
        { provide: MatIconRegistry, useValue: { addSvgIconLiteralInNamespace: register } },
        { provide: DomSanitizer, useValue: { bypassSecurityTrustHtml: trust } },
      ],
    });
    const directive = runInInjectionContext(injector, () => new CedarIconDirective());
    for (const name of iconNames) {
      directive.cedarIcon = name;
      expect(host.svgIcon).toBe('cedar:' + getIcon(name).name);
      expect(register).toHaveBeenLastCalledWith('cedar', getIcon(name).name, iconSvg(name));
    }
    trust.mockClear();
    register.mockClear();
    expect(() => {
      directive.cedarIcon = '<svg onload="alert(1)">';
    }).toThrow(/Unknown CEDAR icon/);
    expect(trust).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});
