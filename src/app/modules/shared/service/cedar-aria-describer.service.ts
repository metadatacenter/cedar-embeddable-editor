import { ElementRef, Injectable, OnDestroy } from '@angular/core';

interface DescriptionEntry {
  element: HTMLElement;
  references: number;
  owned: boolean;
}

/** Keeps CDK aria-describedby messages inside one CEE shadow root. */
@Injectable()
export class CedarAriaDescriber implements OnDestroy {
  private static nextInstanceId = 0;

  private readonly instanceId = CedarAriaDescriber.nextInstanceId++;
  private readonly descriptions = new Map<string | HTMLElement, DescriptionEntry>();
  private readonly hostReferences = new Map<Element, Set<string>>();
  private container: HTMLDivElement | null = null;
  private nextMessageId = 0;

  constructor(private readonly wrapper: ElementRef<HTMLElement>) {}

  describe(hostElement: Element, message: string | HTMLElement, role?: string): void {
    if (!hostElement || !message) {
      return;
    }

    const key = typeof message === 'string' ? `${role ?? ''}\u0000${message}` : message;
    let entry = this.descriptions.get(key);
    if (!entry) {
      const element = typeof message === 'string' ? hostElement.ownerDocument.createElement('div') : message;
      if (!element.id) {
        element.id = `cdk-describedby-message-cee-${this.instanceId}-${this.nextMessageId++}`;
      }
      if (typeof message === 'string') {
        element.textContent = message;
        if (role) {
          element.setAttribute('role', role);
        }
        this.getContainer().appendChild(element);
      }
      entry = { element, references: 0, owned: typeof message === 'string' };
      this.descriptions.set(key, entry);
    }

    const currentIds = this.referenceIds(hostElement);
    if (currentIds.includes(entry.element.id)) {
      return;
    }
    hostElement.setAttribute('aria-describedby', [...currentIds, entry.element.id].join(' '));
    entry.references++;
    const references = this.hostReferences.get(hostElement) ?? new Set<string>();
    references.add(entry.element.id);
    this.hostReferences.set(hostElement, references);
  }

  removeDescription(hostElement: Element, message: string | HTMLElement, role?: string): void {
    if (!hostElement || !message) {
      return;
    }

    const key = typeof message === 'string' ? `${role ?? ''}\u0000${message}` : message;
    const entry = this.descriptions.get(key);
    if (!entry) {
      return;
    }

    const currentIds = this.referenceIds(hostElement);
    if (!currentIds.includes(entry.element.id)) {
      return;
    }
    this.writeReferenceIds(
      hostElement,
      currentIds.filter((id) => id !== entry.element.id),
    );
    const hostIds = this.hostReferences.get(hostElement);
    hostIds?.delete(entry.element.id);
    if (hostIds?.size === 0) {
      this.hostReferences.delete(hostElement);
    }
    entry.references--;
    if (entry.references === 0) {
      if (entry.owned) {
        entry.element.remove();
      }
      this.descriptions.delete(key);
    }
    this.removeEmptyContainer();
  }

  ngOnDestroy(): void {
    for (const [host, ids] of this.hostReferences) {
      this.writeReferenceIds(
        host,
        this.referenceIds(host).filter((id) => !ids.has(id)),
      );
    }
    this.hostReferences.clear();
    this.descriptions.clear();
    this.container?.remove();
    this.container = null;
  }

  private getContainer(): HTMLDivElement {
    if (this.container) {
      return this.container;
    }
    const shadowRoot = this.wrapper.nativeElement.shadowRoot;
    if (!shadowRoot) {
      throw new Error('CEE aria descriptions require the editor shadow root');
    }
    this.container = this.wrapper.nativeElement.ownerDocument.createElement('div');
    this.container.classList.add('cdk-describedby-message-container', 'cdk-visually-hidden');
    this.container.style.visibility = 'hidden';
    shadowRoot.appendChild(this.container);
    return this.container;
  }

  private removeEmptyContainer(): void {
    if (this.container && this.container.childNodes.length === 0) {
      this.container.remove();
      this.container = null;
    }
  }

  private referenceIds(element: Element): string[] {
    return (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  }

  private writeReferenceIds(element: Element, ids: string[]): void {
    if (ids.length > 0) {
      element.setAttribute('aria-describedby', ids.join(' '));
    } else {
      element.removeAttribute('aria-describedby');
    }
  }
}
