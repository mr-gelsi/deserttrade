// Cloudflare Pages Function: handles every request to /api/*
import { handle } from '../../lib/api.js';

export async function onRequest({ request, env, params }) {
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  return handle(request, env, parts);
}
