// Search screen — main entry point for route discovery
// Works online (API) and offline (SQLite cache)

import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../src/store/app.store';
import { apiRequest, OfflineError } from '../../src/services/api.service';
import { searchRoutesOffline } from '../../src/services/offline.service';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';
import { RouteCard } from '../../src/components/search/RouteCard';
import { ConfidenceBadge } from '../../src/components/shared/ConfidenceBadge';

export default function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    isOnline, searchOrigin, searchDestination, searchResults,
    isSearching, searchError, currentCity, userLocation,
    setSearchOrigin, setSearchDestination,
    setSearchResults, setIsSearching, setSearchError,
    setSelectedRoute,
  } = useAppStore();

  const [isOfflineResult, setIsOfflineResult] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchOrigin && !searchDestination) return;
    setIsSearching(true);
    setSearchError(null);
    setIsOfflineResult(false);

    try {
      if (isOnline) {
        const result = await apiRequest<any>({
          url: '/routes/search',
          params: {
            origin: searchOrigin || undefined,
            destination: searchDestination || undefined,
            originLat: userLocation?.latitude,
            originLng: userLocation?.longitude,
            city: currentCity,
          },
        });
        setSearchResults(result ?? []);
      } else {
        throw new OfflineError();
      }
    } catch (err) {
      if (err instanceof OfflineError) {
        // Fall back to local SQLite cache
        const offlineResults = await searchRoutesOffline(searchOrigin, searchDestination);
        setSearchResults(offlineResults);
        setIsOfflineResult(true);
      } else {
        setSearchError(t('errors.generic'));
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchOrigin, searchDestination, isOnline, currentCity, userLocation]);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('search.title')}</Text>

      {!isOnline && <OfflineBanner />}

      {/* Origin input */}
      <TextInput
        style={styles.input}
        placeholder={t('search.origin_placeholder')}
        value={searchOrigin}
        onChangeText={setSearchOrigin}
        returnKeyType="next"
        accessibilityLabel={t('search.origin_placeholder')}
      />

      {/* Destination input */}
      <TextInput
        style={styles.input}
        placeholder={t('search.destination_placeholder')}
        value={searchDestination}
        onChangeText={setSearchDestination}
        returnKeyType="search"
        onSubmitEditing={handleSearch}
        accessibilityLabel={t('search.destination_placeholder')}
      />

      <TouchableOpacity
        style={styles.searchButton}
        onPress={handleSearch}
        disabled={isSearching}
        accessibilityLabel={t('accessibility.search_button_label')}
        accessibilityRole="button"
      >
        {isSearching
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.searchButtonText}>{t('search.search_button')}</Text>
        }
      </TouchableOpacity>

      {/* Offline data notice */}
      {isOfflineResult && (
        <Text style={styles.offlineNotice}>{t('search.offline_notice')}</Text>
      )}

      {/* Error state */}
      {searchError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{searchError}</Text>
          <TouchableOpacity onPress={handleSearch}>
            <Text style={styles.retryText}>{t('errors.try_again')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {searchResults.length === 0 && !isSearching && (searchOrigin || searchDestination) && !searchError && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('search.no_results')}</Text>
          <Text style={styles.emptyHint}>{t('search.no_results_hint')}</Text>
        </View>
      )}

      {searchResults.map((route) => (
        <RouteCard
          key={route.id}
          route={route}
          onPress={() => {
            setSelectedRoute(route);
            router.push(`/route/${route.id}`);
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#1a1a2e' },
  input: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12,
    marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: '#ddd',
  },
  searchButton: {
    backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14,
    alignItems: 'center', marginBottom: 12,
  },
  searchButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  offlineNotice: { color: '#e65100', fontSize: 13, marginBottom: 8 },
  errorBox: { backgroundColor: '#ffebee', padding: 12, borderRadius: 8, marginBottom: 12 },
  errorText: { color: '#c62828', fontSize: 14 },
  retryText: { color: '#1565c0', fontSize: 14, marginTop: 6, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#555' },
  emptyHint: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center' },
});
