// Sync service — manages the sync lifecycle between offline DB and server
// Called: on app launch, on reconnect, on manual pull-to-refresh

import { apiRequest, isOnline } from './api.service';
import {
  storeCityBundle,
  getPendingQueuedReports,
  markReportsUploaded,
  resetOfflineDb,
} from './offline.service';
import * as SecureStore from 'expo-secure-store';

const BUNDLE_KEY = (city: string) => `bundle_version_${city}`;

// ── Check if local bundle is stale ─────────────────────────────
export async function checkSyncNeeded(citySlug: string): Promise<boolean> {
  const online = await isOnline();
  if (!online) return false;

  try {
    const localVersion = await SecureStore.getItemAsync(BUNDLE_KEY(citySlug));
    const manifest = await apiRequest<any>({ url: `/sync/manifest/${citySlug}` });
    return localVersion !== manifest.routesHash;
  } catch {
    return false;
  }
}

// ── Download and cache the city bundle ─────────────────────────
export async function syncCityBundle(citySlug: string): Promise<{ success: boolean; error?: string }> {
  try {
    const bundle = await apiRequest<any>({ url: `/sync/bundle/${citySlug}` });
    await storeCityBundle(bundle);
    await SecureStore.setItemAsync(BUNDLE_KEY(citySlug), bundle.routes ? 'v1' : 'empty');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Upload queued offline reports ──────────────────────────────
export async function uploadQueuedReports(): Promise<{ uploaded: number; failed: number }> {
  const online = await isOnline();
  if (!online) return { uploaded: 0, failed: 0 };

  const pending = await getPendingQueuedReports();
  if (pending.length === 0) return { uploaded: 0, failed: 0 };

  let uploaded = 0;
  let failed = 0;
  const successIds: string[] = [];

  try {
    const result = await apiRequest<any>({
      method: 'POST',
      url: '/sync/upload',
      data: {
        items: pending.map((r) => ({
          type: 'REPORT_SUBMIT',
          payload: { tempId: r.id, ...r },
        })),
      },
    });

    for (const res of result.results ?? []) {
      if (res.status === 'accepted') {
        successIds.push(res.tempId);
        uploaded++;
      } else {
        failed++;
      }
    }
  } catch {
    failed = pending.length;
  }

  if (successIds.length > 0) await markReportsUploaded(successIds);
  return { uploaded, failed };
}

// ── Recover from corrupted local DB ────────────────────────────
export async function recoverOfflineDb(citySlug: string): Promise<void> {
  await resetOfflineDb();
  // Clear stored version so next sync re-downloads
  await SecureStore.deleteItemAsync(BUNDLE_KEY(citySlug));
}
