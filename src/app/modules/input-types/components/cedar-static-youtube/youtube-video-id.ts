const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Hosts that carry the video in the first path segment. */
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

/** Hosts that carry it in `?v=`, or in an `/embed`, `/shorts` or `/live` segment. */
const WATCH_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * Whether a hostname is one this module will take a video from.
 *
 * Exported so a caller can tell "not YouTube at all" from "YouTube, but naming
 * no video" when explaining a rejection. It is an exact-match set, which is what
 * keeps `youtube.com.evil.example` out.
 */
export const isYouTubeHost = (hostname: string): boolean => {
  const host = hostname?.toLowerCase();
  return SHORT_HOSTS.has(host) || WATCH_HOSTS.has(host);
};

/**
 * Accept the values CEDAR templates have historically stored for YouTube
 * fields, but return only a validated video ID. The caller can therefore build
 * an embed URL from a fixed origin instead of trusting template content as a
 * resource URL.
 */
export const extractYouTubeVideoId = (value: string): string => {
  const candidate = value?.trim();
  if (!candidate) {
    return null;
  }
  if (YOUTUBE_VIDEO_ID.test(candidate)) {
    return candidate;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  let videoId: string = null;
  if (SHORT_HOSTS.has(hostname)) {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (WATCH_HOSTS.has(hostname)) {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else {
      const [kind, id] = parsed.pathname.split('/').filter(Boolean);
      if (kind === 'embed' || kind === 'shorts' || kind === 'live') {
        videoId = id ?? null;
      }
    }
  }

  return videoId && YOUTUBE_VIDEO_ID.test(videoId) ? videoId : null;
};
