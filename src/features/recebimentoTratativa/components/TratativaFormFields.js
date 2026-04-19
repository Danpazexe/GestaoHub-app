import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { TRATATIVA_THEME, formatDatePt } from '../constants/tratativaOptions';

export const FieldLabel = ({ label, required, isDarkMode }) => (
  <Text
    style={[
      styles.fieldLabel,
      { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted },
    ]}
  >
    {label}
    {required ? <Text style={styles.requiredMark}> *</Text> : null}
  </Text>
);

export const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  editable = true,
  keyboardType,
  isDarkMode,
  error,
  required = false,
  helperText,
  rightAdornment,
}) => (
  <View style={styles.fieldShell}>
    <FieldLabel label={label} required={required} isDarkMode={isDarkMode} />
    <View
      style={[
        styles.inputShell,
        {
          backgroundColor: isDarkMode ? '#2b3350' : '#f8fafc',
          borderColor: error
            ? '#dc2626'
            : isDarkMode
              ? TRATATIVA_THEME.borderDark
              : TRATATIVA_THEME.border,
          opacity: editable ? 1 : 0.72,
        },
      ]}
    >
      <TextInput
        value={String(value ?? '')}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        editable={editable}
        keyboardType={keyboardType}
        placeholderTextColor={isDarkMode ? '#8b96ba' : '#98a2b3'}
        style={[
          styles.textInput,
          multiline && styles.textArea,
          { color: isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text },
        ]}
      />
      {rightAdornment ? <View style={styles.adornmentShell}>{rightAdornment}</View> : null}
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
    {!error && helperText ? (
      <Text
        style={[
          styles.helperText,
          { color: isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted },
        ]}
      >
        {helperText}
      </Text>
    ) : null}
  </View>
);

export const DateField = ({ label, value, onPress, isDarkMode, required = false, error }) => (
  <View style={styles.fieldShell}>
    <FieldLabel label={label} required={required} isDarkMode={isDarkMode} />
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.dateButton,
        {
          backgroundColor: isDarkMode ? '#2b3350' : '#f8fafc',
          borderColor: error
            ? '#dc2626'
            : isDarkMode
              ? TRATATIVA_THEME.borderDark
              : TRATATIVA_THEME.border,
        },
      ]}
    >
      <Text
        style={[
          styles.dateButtonText,
          {
            color: value
              ? (isDarkMode ? TRATATIVA_THEME.textDark : TRATATIVA_THEME.text)
              : (isDarkMode ? '#8b96ba' : '#98a2b3'),
          },
        ]}
      >
        {value ? formatDatePt(value) : 'Selecionar data'}
      </Text>
      <MaterialIcons
        name="event"
        size={20}
        color={isDarkMode ? TRATATIVA_THEME.textMutedDark : TRATATIVA_THEME.textMuted}
      />
    </TouchableOpacity>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

export const SelectionGrid = ({
  label,
  options,
  selectedValue,
  onSelect,
  isDarkMode,
  required = false,
  error,
}) => (
  <View style={styles.fieldShell}>
    <FieldLabel label={label} required={required} isDarkMode={isDarkMode} />
    <View style={styles.actionGrid}>
      {options.map((item) => {
        const selected = selectedValue === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={[
              styles.actionButton,
              {
                backgroundColor: selected ? item.color : isDarkMode ? '#2b3350' : '#f8fafc',
                borderColor: error
                  ? '#dc2626'
                  : selected
                    ? item.color
                    : isDarkMode
                      ? TRATATIVA_THEME.borderDark
                      : TRATATIVA_THEME.border,
              },
            ]}
          >
            <MaterialIcons
              name={item.icon}
              size={22}
              color={selected ? TRATATIVA_THEME.white : item.color}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: selected ? TRATATIVA_THEME.white : item.color },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

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
  requiredMark: {
    color: '#dc2626',
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    paddingRight: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  adornmentShell: {
    paddingRight: 10,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    width: '48%',
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});

export default {
  FieldLabel,
  FormField,
  DateField,
  SelectionGrid,
};
