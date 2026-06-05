// Nearby stops screen — shows stops near user location
// Gracefully handles GPS denial and offline state

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useAppStore } from '../../src/store/app.store';
import { apiRequest, OfflineError } from '../../src/services/api.service';
import { getNearbyStopsOffline } from '../../src/services/offline.service';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';
import { StopCard } from '../../src/components/shared/StopCard';

export default function NearbyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    isOnline, userLocation, locationPermissionDenied,
    nearbyStops, setNearbyStops, setUserLocation, setLocationPermissionDenied,
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [mapRegion, setMapRegion] = useState<any>(null);

  useEffect(() => { requestLocationAndLoad(); }, []);

  const requestLocationAndLoad = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionDenied(true);
        // Still load nearby stops with a default city center fallback
        await loadNearbyStops(-26.2041, 28.0473); // Joburg CBD default
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude, accuracy: loc.coords.accuracy, timestamp: Date.now() });
      setMapRegion({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      await loadNearbyStops(latitude, longitude);
    } catch {
      // GPS failed — use fallback coordinates
      await loadNearbyStops(-26.2041, 28.0473);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  async function loadNearbyStops(lat: number, lng: number) {
    try {
      if (isOnline) {
        const result = await apiRequest<any[]>({
          url: '/stops/nearby',
          params: { lat, lng, radiusKm: 2 },
        });
        setNearbyStops(result ?? []);
      } else {
        const stops = await getNearbyStopsOffline(lat, lng, 2);
        setNearbyStops(stops);
      }
    } catch (err) {
      if (err instanceof OfflineError) {
        const stops = await getNearbyStopsOffline(lat, lng, 2);
        setNearbyStops(stops);
      }
    }
  }

  return (
    <View style={styles.container}>
      {!isOnline && <OfflineBanner />}

      {/* Location denied notice */}
      {locationPermissionDenied && (
        <View style={styles.locationDenied}>
          <Text style={styles.locationDeniedText}>{t('map.location_denied')}</Text>
          <Text style={styles.locationDeniedHint}>{t('map.location_denied_hint')}</Text>
        </View>
      )}

      {/* Map view — degrades gracefully if MapView fails */}
      {mapRegion && (
        <MapView style={styles.map} region={mapRegion} showsUserLocation>
          {nearbyStops.map((stop) => (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
              title={stop.name}
              description={stop.landmark}
              onPress={() => router.push(`/stop/${stop.id}`)}
            />
          ))}
        </MapView>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1a1a2e" />
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('stops.nearby')}</Text>

      {nearbyStops.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('stops.no_nearby')}</Text>
          <Text style={styles.emptyHint}>{t('stops.no_nearby_hint')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={requestLocationAndLoad}>
            <Text style={styles.retryText}>{t('errors.try_again')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={nearbyStops}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StopCard stop={item} onPress={() => router.push(`/stop/${item.id}`)} />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  map: { height: 220, margin: 12, borderRadius: 10 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 10 },
  locationDenied: { backgroundColor: '#fff3e0', padding: 12, margin: 12, borderRadius: 8 },
  locationDeniedText: { fontWeight: '600', color: '#e65100' },
  locationDeniedHint: { color: '#bf360c', fontSize: 13, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#555' },
  emptyHint: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1a1a2e', borderRadius: 6 },
  retryText: { color: '#fff', fontWeight: '600' },
});
