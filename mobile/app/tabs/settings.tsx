// Settings screen — language, offline sync, city selection

import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../src/store/app.store';
import { SUPPORTED_LANGUAGES } from '../../src/i18n';
import { syncCityBundle } from '../../src/services/sync.service';
import { recoverOfflineDb } from '../../src/services/sync.service';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const {
    language, setLanguage, isSyncing, setIsSyncing,
    setLastSyncedAt, lastSyncedAt, currentCity, setSyncError, syncError,
  } = useAppStore();

  async function handleSyncNow() {
    setIsSyncing(true);
    const result = await syncCityBundle(currentCity);
    setIsSyncing(false);
    if (result.success) {
      setLastSyncedAt(new Date().toISOString());
    } else {
      setSyncError(result.error ?? 'Sync failed');
    }
  }

  async function handleClearCache() {
    Alert.alert(
      'Clear offline data?',
      'This will delete all cached routes and stops. They will be re-downloaded when you are online.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            await recoverOfflineDb(currentCity);
            setLastSyncedAt(null);
          },
        },
      ],
    );
  }

  const syncStatus = lastSyncedAt
    ? t('offline.last_synced', { time: new Date(lastSyncedAt).toLocaleString() })
    : t('offline.never_synced');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      {/* Language selection */}
      <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
      <View style={styles.languageGrid}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.langButton, language === lang.code && styles.langButtonActive]}
            onPress={() => setLanguage(lang.code)}
            accessibilityRole="radio"
            accessibilityState={{ checked: language === lang.code }}
          >
            <Text style={[styles.langText, language === lang.code && styles.langTextActive]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Offline sync */}
      <Text style={styles.sectionLabel}>{t('settings.download_offline')}</Text>
      <Text style={styles.syncStatus}>{syncStatus}</Text>
      {syncError && <Text style={styles.syncError}>{syncError}</Text>}

      <TouchableOpacity
        style={[styles.actionButton, isSyncing && styles.actionButtonDisabled]}
        onPress={handleSyncNow}
        disabled={isSyncing}
      >
        <Text style={styles.actionButtonText}>
          {isSyncing ? t('offline.syncing') : t('offline.sync_now')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={handleClearCache}>
        <Text style={styles.actionButtonText}>{t('settings.clear_cache')}</Text>
      </TouchableOpacity>

      {/* Privacy notice */}
      <View style={styles.privacyBox}>
        <Text style={styles.privacyText}>{t('privacy.anonymous_use')}</Text>
        <Text style={styles.privacyText}>{t('privacy.location_consent')}</Text>
      </View>

      <Text style={styles.version}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#888', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langButton: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff',
  },
  langButtonActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  langText: { fontSize: 14, color: '#333' },
  langTextActive: { color: '#fff', fontWeight: '700' },
  syncStatus: { fontSize: 13, color: '#666', marginBottom: 8 },
  syncError: { fontSize: 13, color: '#c62828', marginBottom: 8 },
  actionButton: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  actionButtonDisabled: { opacity: 0.5 },
  dangerButton: { backgroundColor: '#b71c1c' },
  actionButtonText: { color: '#fff', fontWeight: '700' },
  privacyBox: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 16 },
  privacyText: { fontSize: 12, color: '#2e7d32', marginBottom: 4 },
  version: { textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 24, marginBottom: 40 },
});
