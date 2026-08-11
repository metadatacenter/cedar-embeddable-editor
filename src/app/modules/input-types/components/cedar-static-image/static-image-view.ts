/**
 * What a static image field should render, decided from the template content and
 * whether the browser has already failed to load it.
 *
 * Exactly one of the two is set — written as a union so that is a fact the compiler
 * holds rather than a promise this comment makes. `src` means render the image;
 * `error` means render an explanation instead.
 */
export type StaticImageView = { src: string; error: null } | { src: null; error: string };

/** Schemes that are usable in an `img` `src` and safe to hand the browser. */
const RENDERABLE_SCHEMES = ['http:', 'https:', 'data:'];

/** A leading `scheme:` per RFC 3986. Anything else is a relative reference. */
const ABSOLUTE_URL = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * A `data:` URL that declares an image, whatever the codec.
 *
 * The subtype is unconstrained, and deliberately so: CEE writes this `img` itself
 * and the author supplies only the URL, so the question is whether the payload is
 * an image at all, not which format it is. Enumerating codecs here would reject
 * ones the browser decodes perfectly well, and no `image/` subtype can execute
 * from an `img` `src` — including `svg+xml`, which is why an SVG diagram renders
 * in this field.
 *
 * `template-markup-policy.ts` answers the same input differently, refusing
 * `image/svg+xml`, and that asymmetry is intended rather than an oversight. There,
 * the `img` is one entry in an allowlist over markup the author controls wholesale,
 * and keeping the narrowest list the corpus justifies means a later edit widening
 * the element list cannot combine with an SVG payload to produce a scripting
 * context. Here there is no element list to widen.
 */
const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+\s*[;,]/i;

/**
 * Name a `data:` URL without quoting its payload.
 *
 * Every other message ends in the URL, because the URL is what an author edits. A
 * `data:` URL is not: it can run to hundreds of kilobytes, and the part that says
 * what went wrong is the media type before the comma.
 */
const nameDataUrl = (url: string): string => {
  const comma = url.indexOf(',');
  return comma === -1 ? url : `${url.slice(0, comma + 1)}…`;
};

/**
 * Decide what the field shows.
 *
 * A URL that cannot render is worth saying out loud, because the alternative is
 * what this replaces: an empty card, which reads as an image that has no content
 * rather than one that failed. Every message names the offending URL, since the
 * URL is the only thing that lets a template author fix it.
 *
 * Relative references pass through. Templates legitimately hold them, and only
 * the browser knows what they resolve against, so rejecting them here would fail
 * images that work.
 */
export const resolveStaticImageView = (
  /** Nullable: the caller reads it through `component?.contentInfo?.content`, and the
   * first thing done with it here is `content?.trim()`. The signature said `string`. */
  content: string | null | undefined,
  loadFailed: boolean,
): StaticImageView => {
  const candidate = content?.trim();

  if (!candidate) {
    return { src: null, error: 'This image field has no URL.' };
  }

  if (ABSOLUTE_URL.test(candidate)) {
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return { src: null, error: `This image field holds a URL the browser cannot parse: ${candidate}` };
    }
    if (!RENDERABLE_SCHEMES.includes(parsed.protocol.toLowerCase())) {
      return { src: null, error: `This image field holds a URL that cannot address an image: ${candidate}` };
    }
    if (parsed.protocol.toLowerCase() === 'data:' && !IMAGE_DATA_URL.test(candidate)) {
      return {
        src: null,
        error: `This image field holds a data: URL that carries something other than an image: ${nameDataUrl(
          candidate,
        )}`,
      };
    }
  }

  if (loadFailed) {
    return {
      src: null,
      error: `The image at this URL could not be loaded. It may be missing, or the address may not serve an image: ${candidate}`,
    };
  }

  return { src: candidate, error: null };
};
