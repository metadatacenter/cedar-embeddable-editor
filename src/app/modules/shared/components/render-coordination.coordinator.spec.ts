import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';
import inputTypesTemplate from '../../../../../visual/fixtures/01-input-types.json';
import type { CeeJsonObject } from '../../../cee-public-api';
import { SharedModule } from '../shared.module';
import { CedarComponentRendererComponent } from './cedar-component-renderer/cedar-component-renderer.component';
import { CedarEmbeddableMetadataEditorComponent } from './cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './cedar-embeddable-metadata-editor-wrapper/cedar-embeddable-metadata-editor-wrapper.component';
import { MessageHandlerService } from '../service/message-handler.service';
import { RenderSchedulerService } from '../service/render-scheduler.service';

@Component({
  selector: 'app-scheduler-host',
  template: '<span>{{ value }}</span>',
  providers: [RenderSchedulerService],
})
class SchedulerHostComponent {
  value = 'initial';
}

describe('Angular render coordination', () => {
  it('runs only the newest generation after Angular renders it', async () => {
    await TestBed.configureTestingModule({ imports: [SchedulerHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SchedulerHostComponent);
    const scheduler = fixture.debugElement.injector.get(RenderSchedulerService);
    const seen: string[] = [];

    const stale = scheduler.schedule(() => seen.push('stale'));
    fixture.componentInstance.value = 'newest';
    const newest = scheduler.schedule(() => seen.push(fixture.nativeElement.textContent.trim()));
    fixture.detectChanges();

    expect(await stale).toBe(false);
    expect(await newest).toBe(true);
    expect(seen).toEqual(['newest']);
  });

  it('cancels pending work when the owning component is destroyed', async () => {
    await TestBed.configureTestingModule({ imports: [SchedulerHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SchedulerHostComponent);
    const scheduler = fixture.debugElement.injector.get(RenderSchedulerService);
    const task = vi.fn();

    const pending = scheduler.schedule(task);
    fixture.destroy();

    expect(await pending).toBe(false);
    expect(task).not.toHaveBeenCalled();
  });

  it('compiles and coordinates the real wrapper, editor, and renderer templates', async () => {
    await TestBed.configureTestingModule({
      imports: [SharedModule, TranslateModule.forRoot()],
      providers: [provideHttpClient()],
    }).compileComponents();
    const fixture = TestBed.createComponent(CedarEmbeddableMetadataEditorWrapperComponent);
    const ready = vi.fn();
    const errors = vi.fn();
    fixture.componentInstance.eventHandler = { ready, error: errors };
    fixture.componentInstance.templateObject = inputTypesTemplate as unknown as CeeJsonObject;

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const editor = fixture.debugElement.query(By.directive(CedarEmbeddableMetadataEditorComponent));
    const renderers = fixture.debugElement.queryAll(By.directive(CedarComponentRendererComponent));
    const scopedMessages = fixture.debugElement.injector.get(MessageHandlerService);

    expect(editor).not.toBeNull();
    expect(renderers.length).toBeGreaterThan(0);
    expect(fixture.componentInstance.handlerContext.messageHandlerService).toBe(scopedMessages);
    expect(errors).not.toHaveBeenCalled();
    expect(ready).toHaveBeenCalledTimes(1);
  });
});
