import HapticFeedback from 'react-native-haptic-feedback';

const OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

// Wrapper best-effort sobre react-native-haptic-feedback: nunca lança e
// centraliza o objeto de options que antes era repetido em cada tela.
const trigger = (type) => {
  try {
    HapticFeedback.trigger(type, OPTIONS);
  } catch (error) {
    // haptics são puramente cosméticos; ignore falhas (device sem motor, etc).
  }
};

export const haptics = {
  light: () => trigger('impactLight'),
  medium: () => trigger('impactMedium'),
  heavy: () => trigger('impactHeavy'),
  selection: () => trigger('selection'),
  success: () => trigger('notificationSuccess'),
  warning: () => trigger('notificationWarning'),
  error: () => trigger('notificationError'),
};

export default haptics;
