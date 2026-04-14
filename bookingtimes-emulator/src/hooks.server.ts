import type { Handle } from '@sveltejs/kit';
import { getD1Compat } from '$lib/server/db';
import { getLocalStorage } from '$lib/server/storage';
import { getLocalCache } from '$lib/server/cache';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.db = getD1Compat();
  event.locals.storage = getLocalStorage();
  event.locals.cache = getLocalCache();
  return resolve(event);
};
