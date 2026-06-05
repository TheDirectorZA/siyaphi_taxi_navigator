// Report submission screen — works fully offline (queues reports)

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { useAppStore } from '../../src/store/app.store';
import { apiRequest, OfflineError } from '../../src/services/api.service';
import { queueReportOffline } from '../../src/services/offline.service';

const REPORT_TYPES = [
  'DELAY', 'TAXI_FULL', 'TAXI_NOT_AVAILABLE',
  'DISRUPTION', 'SAFETY_INCIDENT', 'RANK_CONGESTION',
  'ROUTE_CHANGE', 'FARE_CHANGE', 'OTHER',
];

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function ReportSubmitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { routeId, stopId, cityId } = useLocalSearchParams<{ routeId?: string; stopId?: string; cityId?: string }>();
  const { isOnline, currentCity, userLocation } = useAppStore();

  const [selectedType, setSelectedType] = useState('DELAY');
  const [selectedSeverity, setSelectedSeverity] = useState('LOW');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    const reportPayload = {
      cityId: cityId ?? currentCity,
      type: selectedType,
      severity: selectedSeverity,
      description: description.trim() || undefined,
      latitude: userLocation?.latitude,
      longitude: userLocation?.longitude,
      routeId: routeId ?? undefined,
      stopId: stopId ?? undefined,
    };

    try {
      if (isOnline) {
        await apiRequest({ method: 'POST', url: '/reports', data: reportPayload });
        Alert.alert('', t('reports.submit_success'), [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        throw new OfflineError();
      }
    } catch (err) {
      if (err instanceof OfflineError) {
        await queueReportOffline(reportPayload);
        Alert.alert('', t('reports.submit_offline'), [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        Alert.alert('Error', t('reports.submit_error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const typeKey = (type: string) => `reports.type_${type.toLowerCase()}`;
  const severityKey = (s: string) => `reports.severity_${s.toLowerCase()}`;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('reports.submit')}</Text>

      {/* Report type */}
      <Text style={styles.label}>Issue type</Text>
      <View style={styles.chipGrid}>
        {REPORT_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, selectedType === type && styles.chipActive]}
            onPress={() => setSelectedType(type)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedType === type }}
          >
            <Text style={[styles.chipText, selectedType === type && styles.chipTextActive]}>
              {t(typeKey(type) as any, { defaultValue: type })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Severity */}
      <Text style={styles.label}>How serious?</Text>
      <View style={styles.chipGrid}>
        {SEVERITY_LEVELS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, selectedSeverity === s && styles.chipActiveSeverity]}
            onPress={() => setSelectedSeverity(s)}
          >
            <Text style={[styles.chipText, selectedSeverity === s && styles.chipTextActive]}>
              {t(severityKey(s) as any, { defaultValue: s })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description */}
      <Text style={styles.label}>Details (optional)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Describe what you're seeing..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        maxLength={500}
      />
      <Text style={styles.charCount}>{description.length}/500</Text>

      {/* Privacy notice */}
      <Text style={styles.privacyNote}>{t('privacy.report_privacy')}</Text>

      {!isOnline && (
        <Text style={styles.offlineNote}>You're offline — this report will be sent when you reconnect.</Text>
      )}

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitButtonText}>Submit Report</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a2e', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  chipActiveSeverity: { backgroundColor: '#c62828', borderColor: '#c62828' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  textArea: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12,
    fontSize: 14, borderWidth: 1, borderColor: '#ddd', minHeight: 80,
  },
  charCount: { fontSize: 12, color: '#aaa', textAlign: 'right', marginTop: 4 },
  privacyNote: { fontSize: 12, color: '#2e7d32', marginTop: 12, fontStyle: 'italic' },
  offlineNote: { fontSize: 13, color: '#e65100', marginTop: 8, backgroundColor: '#fff3e0', padding: 10, borderRadius: 6 },
  submitButton: { backgroundColor: '#c62828', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
