/** Browser Worker adapter for headless tests; executes the production source in real Node workers. */
import { Worker as NodeWorker } from 'node:worker_threads';
import { Blob as NodeBlob, resolveObjectURL } from 'node:buffer';
import { URL as NodeURL } from 'node:url';

class RegexTestWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  private worker: NodeWorker | null = null;
  private closed = false;
  private readonly queued: unknown[] = [];
  constructor(url: string) {
    const blob = resolveObjectURL(url);
    if (!blob) throw new Error('Missing worker source');
    void blob.text().then((source) => {
      if (this.closed) return;
      const worker = new NodeWorker(
        `const {parentPort}=require('node:worker_threads');
        globalThis.postMessage=(data)=>parentPort.postMessage(data);
        parentPort.on('message',(data)=>globalThis.onmessage({data}));\n${source}`,
        { eval: true },
      );
      this.worker = worker;
      worker.on('message', (data) => this.onmessage?.({ data }));
      worker.on('error', () => this.onerror?.());
      for (const value of this.queued) worker.postMessage(value);
      this.queued.length = 0;
      worker.unref();
    });
  }
  postMessage(value: unknown): void {
    if (this.worker) this.worker.postMessage(value);
    else this.queued.push(value);
  }
  terminate(): void {
    this.closed = true;
    this.queued.length = 0;
    void this.worker?.terminate();
  }
}
Object.defineProperty(globalThis, 'Blob', { value: NodeBlob, configurable: true, writable: true });
Object.defineProperty(globalThis, 'Worker', { value: RegexTestWorker, configurable: true, writable: true });
Object.defineProperty(URL, 'createObjectURL', { value: NodeURL.createObjectURL, configurable: true, writable: true });
URL.revokeObjectURL = NodeURL.revokeObjectURL;
