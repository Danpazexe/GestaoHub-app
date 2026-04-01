import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  formatSelectionSummary,
  normalizeSelectionValues,
  TRATATIVA_THEME,
} from '../constants/tratativaOptions';

const MultiSelectFieldModal = ({
  label,
  placeholder,
  options = [],
  selectedValues = [],
  onApply,
  isDarkMode = false,
  buttonLabel = 'Selecionar',
}) => {
  const [visible, setVisible] = useState(false);
  const [draftValues, setDraftValues] = useState([]);

  const normalizedSelected = useMemo(
    () => normalizeSelectionValues(selectedValues),
    [selectedValues],
  );

  useEffect(() => {
    if (!visible) {
      setDraftValues(normalizedSelected);
    }
  }, [normalizedSelected, visible]);

  const openModal = () => {
    setDraftValues(normalizedSelected);
    setVisible(true);
  };

  const closeModal = () => {
    setDraftValues(normalizedSelected);
    setVisible(false);
  };

  const toggleValue = (value) => {
    setDraftValues((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  };

  const handleApply = () => {
    onApply(normalizeSelectionValues(draftValues));
    setVisible(false);
  };

  const summary = formatSelectionSummary(normalizedSelected, {
    emptyLabel: placeholder,
    maxItems: 2,
  });

  return (
    <View style={styles.fieldShell}>
      <Text style={[styles.fieldLabel, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
        {label}
      </Text>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={openModal}
        style={[
          styles.selectorCard,
          {
            backgroundColor: isDarkMode ? '#2b3350' : '#f8fafc',
            borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border,
          },
        ]}
      >
        <View style={styles.selectorTopRow}>
          <Text
            numberOfLines={2}
            style={[
              styles.selectorSummary,
              {
                color: normalizedSelected.length
                  ? (isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text)
                  : (isDarkMode ? '#8b96ba' : '#98a2b3'),
              },
            ]}
          >
            {summary}
          </Text>
          <MaterialIcons
            name="expand-more"
            size={22}
            color={isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted}
          />
        </View>

        {normalizedSelected.length > 0 ? (
          <View style={styles.chipRow}>
            {normalizedSelected.slice(0, 2).map((item) => (
              <View
                key={item}
                style={[
                  styles.valueChip,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#ffffff' },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.valueChipText,
                    { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
            {normalizedSelected.length > 2 ? (
              <View
                style={[
                  styles.extraChip,
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.10)' : '#fff1eb' },
                ]}
              >
                <Text style={[styles.extraChipText, { color: TRATATIVA_THEME.primary }]}>
                  +{normalizedSelected.length - 2}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.selectorFooter}>
          <Text style={[styles.selectorFooterText, { color: TRATATIVA_THEME.primary }]}>
            {buttonLabel}
          </Text>
        </View>
      </TouchableOpacity>

      <Portal>
        <Modal
          visible={visible}
          onDismiss={closeModal}
          contentContainerStyle={[
            styles.modalCard,
            { backgroundColor: isDarkMode ? TRATATIVA_THEME.cardDark : TRATATIVA_THEME.card },
          ]}
        >
          <Text style={[styles.modalTitle, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
            {label}
          </Text>
          <Text style={[styles.modalSubtitle, { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted }]}>
            Selecione uma ou mais opções.
          </Text>

          <ScrollView
            style={styles.optionsList}
            contentContainerStyle={styles.optionsListContent}
            showsVerticalScrollIndicator={false}
          >
            {options.map((item) => {
              const selected = draftValues.includes(item);

              return (
                <TouchableOpacity
                  key={item}
                  activeOpacity={0.85}
                  onPress={() => toggleValue(item)}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: selected
                        ? (isDarkMode ? 'rgba(194, 65, 12, 0.18)' : '#fff1eb')
                        : (isDarkMode ? '#2b3350' : '#f8fafc'),
                      borderColor: selected
                        ? TRATATIVA_THEME.primary
                        : (isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border),
                    },
                  ]}
                >
                  <MaterialIcons
                    name={selected ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={selected ? TRATATIVA_THEME.primary : (isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted)}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text },
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={() => setDraftValues([])}
              style={[styles.modalActionButton, styles.clearAction]}
            >
              <Text style={[styles.modalActionText, { color: TRATATIVA_THEME.primary }]}>Limpar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={closeModal}
              style={[
                styles.modalActionButton,
                {
                  backgroundColor: isDarkMode ? '#2b3350' : '#f8fafc',
                  borderColor: isDarkMode ? TRATATIVA_THEME.borderDark : TRATATIVA_THEME.border,
                },
              ]}
            >
              <Text style={[styles.modalActionText, { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text }]}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              style={[styles.modalActionButton, styles.applyAction]}
            >
              <Text style={[styles.modalActionText, styles.applyActionText]}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  fieldShell: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  selectorCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  selectorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectorSummary: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  valueChip: {
    maxWidth: '78%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  valueChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  extraChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  extraChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectorFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  selectorFooterText: {
    fontSize: 13,
    fontWeight: '800',
  },
  modalCard: {
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  optionsList: {
    maxHeight: 360,
    marginTop: 16,
  },
  optionsListContent: {
    gap: 10,
  },
  optionRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  clearAction: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  applyAction: {
    backgroundColor: TRATATIVA_THEME.primary,
    borderColor: TRATATIVA_THEME.primary,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  applyActionText: {
    color: '#ffffff',
  },
});

export default MultiSelectFieldModal;
