import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

// Envolve formulários para o teclado não cobrir inputs/botões (Login, Perfil, etc).
// scroll=true (padrão) usa ScrollView; scroll=false mantém um View flex para telas
// que já têm a própria rolagem ou layout fixo.
const KeyboardAwareScreen = ({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  ...rest
}) => {
  const innerProps = scroll
    ? {
        keyboardShouldPersistTaps: 'handled',
        showsVerticalScrollIndicator: false,
        contentContainerStyle: [styles.scrollContent, contentContainerStyle],
      }
    : { style: [styles.flex, contentContainerStyle] };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      {...rest}
    >
      {scroll ? (
        <ScrollView {...innerProps}>{children}</ScrollView>
      ) : (
        <View {...innerProps}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});

export default KeyboardAwareScreen;
