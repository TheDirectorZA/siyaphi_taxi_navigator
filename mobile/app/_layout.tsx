// App entry point — sets up providers and navigation
import '../src/i18n';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import { useAppStore } from '../src/store/app.store';
import { liveUpdateService } from '../src/services/live-updates.service';
import { checkSyncNeeded, syncCityBundle, uploadQueuedReports } from '../src/services/sync.service';
import { apiRequest } from '../src/services/api.service';
import i18n from '../src/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1, retryDelay: 2000 },
  },
});

export default function RootLayout() {
  const { setIsOnline, currentCity, setIsSyncing, setLastSyncedAt, language } = useAppStore();

  useEffect(() => {
    initializeApp();
    const networkSub = Network.addNetworkStateListener(({ isConnected }) => {
      setIsOnline(!!isConnected);
      if (isConnected) uploadQueuedReports();
    });
    return () => { networkSub.remove(); liveUpdateService.disconnect(); };
  }, []);

  useEffect(() => { i18n.changeLanguage(language); }, [language]);

  async function initializeApp() {
    let token = await SecureStore.getItemAsync('access_token');
    if (!token) {
      try {
        const result = await apiRequest<any>({
          method: 'POST', url: '/auth/device/register', data: { platform: 'android', language },
        });
        await SecureStore.setItemAsync('access_token', result.accessToken);
        await SecureStore.setItemAsync('device_id', result.deviceId);
      } catch { /* offline — continue without auth */ }
    }

    const needsSync = await checkSyncNeeded(currentCity);
    if (needsSync) {
      setIsSyncing(true);
      const result = await syncCityBundle(currentCity);
      setIsSyncing(false);
      if (result.success) setLastSyncedAt(new Date().toISOString());
    }

    liveUpdateService.connect();
    liveUpdateService.subscribeToCity(currentCity);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="route/[id]" options={{ title: 'Route Details' }} />
          <Stack.Screen name="stop/[id]" options={{ title: 'Stop Details' }} />
          <Stack.Screen name="report/submit" options={{ title: 'Report an Issue' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
