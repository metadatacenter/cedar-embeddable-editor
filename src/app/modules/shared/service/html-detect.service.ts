import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class HtmlDetectService {
  constructor() {}
  isHtmlString(str: string): boolean {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/html');
    return Array.from(doc.body.childNodes).some((node) => node.nodeType === Node.ELEMENT_NODE);
  }
}
