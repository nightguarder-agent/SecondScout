import type { Handle } from '@sveltejs/kit';

// Handle function (required for hooks)
export const handle: Handle = async ({ event, resolve }) => {
    return resolve(event);
};
