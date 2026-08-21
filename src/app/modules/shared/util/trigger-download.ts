/**
 * Hand the browser a file.
 *
 * The anchor is appended to the host document rather than to CEE's shadow root.
 * A click on a detached node does nothing in some engines, and a shadow root is
 * not a document, so this is the one place CEE deliberately reaches outside its
 * own tree. It removes what it added and revokes the URL, so nothing of CEE's is
 * left in the host's DOM.
 *
 * A page-initiated download can be refused by a sandboxed host, and there is no
 * event to observe when that happens. So this reports what it attempted rather
 * than claiming success, and the caller traces it: a developer who sees the
 * trace and no file knows to look at their own sandbox rather than at CEE.
 */
export const triggerDownload = (filename: string, mediaType: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
