import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { GlobalSettingsContextService } from './global-settings-context.service';
import {
  ResourceDescription,
  ConstraintReference,
  landingLink,
  sourceReference,
  termReference,
} from '../models/terminology-resource';
import { SpecTermSource } from '../util/field-spec';
import { ControlledInfo } from '../models/info/controlled-info.model';

/** Small read-through resolver for existing link slots. Full batch/revalidation policy is separate. */
@Injectable({ providedIn: 'root' })
export class ResourceDescriptionService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly settings = inject(GlobalSettingsContextService);
  private readonly retryAfter = new Map<string, number>();
  private readonly descriptions = signal(new Map<string, ResourceDescription | null>());

  describe(ref: ConstraintReference | null): ResourceDescription | null {
    const base = this.settings.terminologyBaseUrl;
    if (!ref || !base || !this.http) return null;
    const key = base + JSON.stringify(ref);
    const cached = this.descriptions();
    if ((this.retryAfter.get(key) ?? 0) > Date.now()) return null;
    if (cached.has(key)) return cached.get(key) ?? null;
    // Mark in flight without notifying the view that is currently reading this signal.
    cached.set(key, null);
    this.http.post<ResourceDescription>(base + 'resources/description', ref).subscribe({
      next: (description) =>
        this.descriptions.update((old) => {
          const next = new Map(old);
          if (next.size > 512) next.delete(next.keys().next().value!);
          next.set(key, description);
          return next;
        }),
      // A missing description leaves the stored name readable. Do not change the selected value.
      error: () => {
        this.descriptions().delete(key);
        this.retryAfter.set(key, Date.now() + 30_000);
      },
    });
    return null;
  }

  sourceLink(source: SpecTermSource): string | null {
    return landingLink(this.describe(sourceReference(source))?.presentation)?.href ?? null;
  }

  termLink(controlled: ControlledInfo, iri: string | null | undefined) {
    return landingLink(this.describe(termReference(controlled, iri))?.presentation);
  }
}
