// Route detail screen — shows full route info, fare, ETA, live reports

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../src/store/app.store';
import { apiRequest } from '../../src/services/api.service';
import { liveUpdateService } from '../../src/services/live-updates.service';
import { ConfidenceBadge } from '../../src/components/shared/ConfidenceBadge';
import { FareDisplay } from '../../src/components/search/FareDisplay';
import { EtaDisplay } from '../../src/components/search/EtaDisplay';
import { ReportCard } from '../../src/components/reports/ReportCard';
import { OfflineBanner } from '../../src/components/shared/OfflineBanner';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { isOnline, selectedRoute, activeReports, addReport, removeReport } = useAppStore();

  const [route, setRoute] = useState<any>(selectedRoute);
  const [routeReports, setRouteReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(!selectedRoute);

  useEffect(() => {
    if (id) {
      loadRoute(id);
      loadRouteReports(id);
      liveUpdateService.subscribeToRoute(id);

      const unsub = liveUpdateService.onReport((report) => {
        if (report.routeId === id) {
          if (report._expired) {
            setRouteReports((prev) => prev.filter((r) => r.id !== report.id));
          } else {
            setRouteReports((prev) => [report, ...prev]);
          }
        }
      });

      return () => { unsub(); liveUpdateService.unsubscribeFromRoute(id); };
    }
  }, [id]);

  async function loadRoute(routeId: string) {
    if (route?.id === routeId) return;
    setIsLoading(true);
    try {
      const data = await apiRequest<any>({ url: `/routes/${routeId}` });
      setRoute(data);
    } catch { /* use selectedRoute from store */ }
    finally { setIsLoading(false); }
  }

  async function loadRouteReports(routeId: string) {
    try {
      const reports = await apiRequest<any[]>({ url: '/reports', params: { routeId } });
      setRouteReports(reports ?? []);
    } catch { /* no live reports available */ }
  }

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a1a2e" />;
  if (!route) return (
    <View style={styles.errorState}>
      <Text style={styles.errorText}>{t('errors.generic')}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {!isOnline && <OfflineBanner />}

      {/* Route header */}
      <View style={styles.header}>
        <Text style={styles.routeName}>{route.name}</Text>
        {route.shortCode && <Text style={styles.shortCode}>{route.shortCode}</Text>}
        <ConfidenceBadge confidence={route.dataConfidence} dataAgeDays={route.dataAgeDays} />
      </View>

      {/* Origin → Destination */}
      <View style={styles.card}>
        <Text style={styles.label}>{t('route.from')}</Text>
        <Text style={styles.value}>{route.originName}</Text>
        <Text style={styles.label}>{t('route.to')}</Text>
        <Text style={styles.value}>{route.destinationName}</Text>
        {route.distanceKm && (
          <Text style={styles.meta}>{t('route.distance', { km: route.distanceKm.toFixed(1) })}</Text>
        )}
        {route.frequencyMinutes && (
          <Text style={styles.meta}>{t('route.frequency', { min: route.frequencyMinutes })}</Text>
        )}
      </View>

      {/* Fare */}
      <FareDisplay fare={route.fare} />

      {/* ETA */}
      <EtaDisplay eta={route.eta} isPeak={route.isPeakHours} />

      {/* Stops list */}
      {route.stops?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('route.stops')}</Text>
          {route.stops.map((rs: any) => (
            <TouchableOpacity
              key={rs.sequence}
              style={styles.stopRow}
              onPress={() => rs.stop?.id && router.push(`/stop/${rs.stop.id}`)}
            >
              <View style={[styles.stopDot, rs.isTerminal && styles.stopDotTerminal]} />
              <Text style={styles.stopName}>{rs.stop?.name ?? 'Unknown stop'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Live reports on this route */}
      {routeReports.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('reports.title')}</Text>
          {routeReports.map((r) => <ReportCard key={r.id} report={r} />)}
        </View>
      )}

      {/* Report button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => router.push({ pathname: '/report/submit', params: { routeId: route.id, cityId: route.city?.id } })}
      >
        <Text style={styles.reportButtonText}>{t('reports.submit')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#1a1a2e', padding: 20 },
  routeName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  shortCode: { fontSize: 13, color: '#aaa', marginTop: 2 },
  card: { backgroundColor: '#fff', margin: 12, borderRadius: 10, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginTop: 8 },
  value: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  meta: { fontSize: 13, color: '#666', marginTop: 4 },
  stopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  stopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ccc', marginRight: 10 },
  stopDotTerminal: { backgroundColor: '#1a1a2e', width: 10, height: 10, borderRadius: 5 },
  stopName: { fontSize: 14, color: '#333' },
  section: { margin: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e', marginBottom: 8 },
  reportButton: {
    backgroundColor: '#c62828', margin: 12, padding: 14,
    borderRadius: 8, alignItems: 'center', marginBottom: 32,
  },
  reportButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#c62828', fontSize: 16 },
});
