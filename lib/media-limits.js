// Limits for uploaded video and audio (shared by the browser and the server).
export const PART_SIZE = 3 * 1024 * 1024; // each upload request carries one 3 MB piece
export const MAX_FILE = 60 * 1024 * 1024; // one file
export const MAX_TOTAL = 300 * 1024 * 1024; // everything one person has uploaded
export const MEDIA_TYPES = /^(video\/(mp4|webm|quicktime|ogg)|audio\/(mpeg|mp3|mp4|aac|x-m4a|m4a|wav|x-wav|wave|ogg|webm|flac))$/;
export const isMediaUrl = (s) => typeof s === 'string' && /^\/api\/media\/[A-Za-z0-9_-]{8,40}$/.test(s);
