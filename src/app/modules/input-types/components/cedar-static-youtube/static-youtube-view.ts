import { extractYouTubeVideoId, isYouTubeHost } from './youtube-video-id';

/**
 * What a static YouTube field should render.
 *
 * Exactly one of the two is set — written as a union so that is a fact the compiler
 * holds rather than a promise this comment makes. `videoId` means embed it;
 * `error` means say why there is nothing to embed.
 */
export type StaticYoutubeView = { videoId: string; error: null } | { videoId: null; error: string };

/**
 * Decide what the field shows, and when it shows nothing, say why.
 *
 * `extractYouTubeVideoId` is deliberately strict, and rightly so: it is what
 * keeps `youtube.com.evil.example` from becoming an embed origin. But it answers
 * only yes or no, and the component threw the no away, leaving the field's red
 * card standing empty. A colour that reads as an error while naming no cause is
 * worse than no signal at all.
 *
 * So the rejection is diagnosed here rather than in the extractor, which stays a
 * single trusted yes-or-no. The three causes are worth telling apart because
 * they call for different corrections: a playlist link needs a different link, a
 * Vimeo link needs a different field, and a malformed ID needs a typo fixed.
 */
export const resolveStaticYoutubeView = (content: string): StaticYoutubeView => {
  const candidate = content?.trim();

  if (!candidate) {
    return { videoId: null, error: 'This video field has no YouTube link.' };
  }

  const videoId = extractYouTubeVideoId(candidate);
  if (videoId) {
    return { videoId, error: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      videoId: null,
      error: `This video field holds neither a YouTube link nor a video ID: ${candidate}`,
    };
  }

  if (!isYouTubeHost(parsed.hostname)) {
    return {
      videoId: null,
      error: `This video field holds a link to ${parsed.hostname}, and only YouTube videos can be embedded: ${candidate}`,
    };
  }

  // A YouTube address that carried something in a video-ID position, but not a
  // valid ID: a typo rather than the wrong kind of link.
  const [kind] = parsed.pathname.split('/').filter(Boolean);
  const namedAVideo = parsed.searchParams.has('v') || kind === 'embed' || kind === 'shorts' || kind === 'live';
  if (namedAVideo) {
    return {
      videoId: null,
      error: `This YouTube link carries a video ID that is not valid: ${candidate}`,
    };
  }

  return {
    videoId: null,
    error: `This YouTube link names no single video, so there is nothing to embed. Playlist, channel and search links cannot be embedded: ${candidate}`,
  };
};
