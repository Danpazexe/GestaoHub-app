import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TRATATIVA_THEME,
  TRATATIVA_TIMELINE_STEPS,
  deriveProgress,
  formatDatePt,
} from '../constants/tratativaOptions';

const TratativaTimeline = ({ caseItem, isDarkMode = false }) => {
  const progress = deriveProgress(caseItem);
  const activeIndex = Math.max(
    0,
    TRATATIVA_TIMELINE_STEPS.reduce((lastDone, step, index) => (caseItem?.[step.key] ? index : lastDone), 0),
  );

  return (
    <View>
      <View style={styles.timelineRow}>
        {TRATATIVA_TIMELINE_STEPS.map((step, index) => {
          const isDone = Boolean(caseItem?.[step.key]) && index < activeIndex;
          const isActive = index === activeIndex;
          const circleBackground = isDone
            ? (isDarkMode ? '#1e7f74' : '#d1fae5')
            : isActive
              ? (isDarkMode ? '#9a6b1c' : '#fff4cf')
              : (isDarkMode ? '#3a4265' : '#eef2f7');

          return (
            <View key={step.key} style={styles.step}>
              <View style={[styles.circle, { backgroundColor: circleBackground }]}>
                <Text style={[styles.circleText, { color: isDarkMode ? '#f3f5ff' : '#1f2937' }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.label, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>{step.label}</Text>
              <Text style={[styles.date, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>{formatDatePt(caseItem?.[step.key])}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.progressShell, { backgroundColor: isDarkMode ? '#334155' : '#eef2f7' }]}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={[styles.progressText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>{progress}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  circleText: {
    fontWeight: '800',
    color: '#1f2937',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  date: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  progressShell: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 18,
  },
  progressFill: {
    height: '100%',
    backgroundColor: TRATATIVA_THEME.primary,
  },
  progressText: {
    marginTop: 8,
    fontWeight: '800',
    textAlign: 'right',
  },
});

export default TratativaTimeline;

