// Live Updates screen — shows active crowd reports
// Receives real-time updates via WebSocket
// Falls back to polling or cached reports when offline

import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../src/store/app.store';
import { apiRequest } from '../../src/services/api.service';
import { liveUpdateService } from '../../src/services/live-updates.service';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';
import { ReportCard } from '../../src/components/reports/ReportCard';

export default function UpdatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOnline, activeReports, setActiveReports, addReport, removeReport, currentCity } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  useEffect(() => {
    loadReports();

    // Subscribe to live updates
    const unsub = liveUpdateService.onReport((report) => {
      if (report._expired) {
        removeReport(report.id);
      } else {
        addReport(report);
      }
    });

    // Poll WS status for UI indicator
    const statusInterval = setInterval(() => {
      setWsStatus(liveUpdateService.getConnectionStatus());
    }, 3000);

    return () => { unsub(); clearInterval(statusInterval); };
  }, [currentCity]);

  async function loadReports() {
    setIsLoading(true);
    try {
      const reports = await apiRequest<any[]>({
        url: '/reports',
        params: { cityId: currentCity },
      });
      setActiveReports(reports ?? []);
    } catch {
      // Offline — keep existing cached reports in store
    } finally {
      setIsLoading(false);
    }
  }

  const wsStatusColor = { connected: '#2e7d32', disconnected: '#aaa', reconnecting: '#f57f17' }[wsStatus];
  const wsStatusLabel = { connected: 'Live', disconnected: 'Offline', reconnecting: 'Reconnecting...' }[wsStatus];

  return (
    <View style={styles.container}>
      {!isOnline && <OfflineBanner />}

      <View style={styles.header}>
        <Text style={styles.title}>{t('reports.title')}</Text>
        <View style={styles.wsIndicator}>
          <View style={[styles.wsDot, { backgroundColor: wsStatusColor }]} />
          <Text style={[styles.wsLabel, { color: wsStatusColor }]}>{wsStatusLabel}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={() => router.push('/report/submit')}
        accessibilityLabel={t('accessibility.report_button_label')}
      >
        <Text style={styles.submitButtonText}>{t('reports.submit')}</Text>
      </TouchableOpacity>

      {isLoading && <ActivityIndicator style={{ marginVertical: 20 }} color="#1a1a2e" />}

      {!isLoading && activeReports.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('reports.no_reports')}</Text>
        </View>
      )}

      <FlatList
        data={activeReports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReportCard report={item} />}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadReports} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  wsIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wsDot: { width: 8, height: 8, borderRadius: 4 },
  wsLabel: { fontSize: 12, fontWeight: '600' },
  submitButton: {
    backgroundColor: '#c62828', margin: 12, marginTop: 0, padding: 14,
    borderRadius: 8, alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontSize: 16, color: '#888' },
});
