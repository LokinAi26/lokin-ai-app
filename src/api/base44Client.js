import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Time-sensitive provider functions must not inherit a stale preview/sandbox
// version pin from localStorage. Omitting Base44-Functions-Version routes these
// calls to the app's latest deployed backend revision.
export const base44LiveFunctions = createClient({
  appId,
  token,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
