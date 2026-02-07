import PocketBase from 'pocketbase';

const pbUrl = import.meta.env.VITE_PB_URL || 'http://127.0.0.1:8116';
export const pb = new PocketBase(pbUrl);

// Handle auth state persistence if needed (PocketBase handles this via cookie/localStorage automatically)
