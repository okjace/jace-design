// Limits for uploaded video and audio (shared by the browser and the server).
export const PART_SIZE = 3 * 1024 * 1024; // each upload request carries one 3 MB piece
export const MAX_FILE = 4 * 1024 * 1024 * 1024; // one file (4 GB: effectively no limit)
// Total per person: no limit unless the site owner sets MEDIA_LIMIT_MB (server only).
export const MAX_TOTAL = typeof process !== 'undefined' && Number(process.env.MEDIA_LIMIT_MB) > 0 ? Number(process.env.MEDIA_LIMIT_MB) * 1024 * 1024 : Infinity;
export const MEDIA_TYPES = /^(video\/(mp4|webm|quicktime|ogg|x-matroska)|audio\/(mpeg|mp3|mp4|aac|x-m4a|m4a|wav|x-wav|wave|ogg|webm|flac)|image\/(png|jpeg|webp|gif|svg\+xml)|font\/(ttf|otf|woff2?)|application\/(font-woff2?|x-font-ttf|x-font-otf|octet-stream|pdf))$/;
export const isMediaUrl = (s) => typeof s === 'string' && /^\/api\/media\/[A-Za-z0-9_-]{8,40}$/.test(s);
