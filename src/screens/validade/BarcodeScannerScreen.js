import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  BackHandler,
  Linking,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import changeNavigationBarColor, { hideNavigationBar, showNavigationBar } from 'react-native-navigation-bar-color';
import Sound from 'react-native-sound';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import HapticFeedback from 'react-native-haptic-feedback';
import Toast from 'react-native-toast-message';
import { CORESBARCODESCANNER } from '../../components/coresAuth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_BOX_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 330);
const SCAN_BOX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.28, 240);

const SCAN_CODE_TYPES = [
  'ean-13',
  'ean-8',
  'upc-a',
  'upc-e',
  'code-128',
  'code-39',
  'code-93',
  'itf',
  'codabar',
];

const COLORS = CORESBARCODESCANNER;

const isPermissionGranted = (status) =>
  status === true || status === 'granted' || status === 'authorized';

const BarcodeScannerScreen = ({ navigation, route }) => {
  const isFocused = useIsFocused();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const flashAvailable = Boolean(device?.hasTorch || device?.hasFlash);

  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [barcodeData, setBarcodeData] = useState('');
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const backHandlerRef = useRef(null);
  const scannerLockedRef = useRef(false);
  const soundRef = useRef(null);
  const mountedRef = useRef(true);
  const scanLineLoopRef = useRef(null);
  const flashWarningShownRef = useRef(false);

  const cleanupResources = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.release();
      soundRef.current = null;
    }
  }, []);

  const loadSound = useCallback(() => {
    if (soundRef.current) {
      return;
    }

    Sound.setCategory('Playback');
    const beep = new Sound(require('../../../assets/Sound/Beep.mp3'), (error) => {
      if (!error && mountedRef.current) {
        soundRef.current = beep;
      }
    });
  }, []);

  const playBeep = useCallback(() => {
    const activeSound = soundRef.current;
    if (activeSound) {
      activeSound.stop(() => {
        activeSound.play();
      });
    }
  }, []);

  const startScanLineAnimation = useCallback(() => {
    scanLineLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    scanLineLoopRef.current.start();
  }, [scanLineAnim]);

  const ensurePermission = useCallback(async () => {
    try {
      const currentStatus = await Camera.getCameraPermissionStatus();
      let granted = isPermissionGranted(currentStatus);

      if (!granted && currentStatus === 'not-determined') {
        const status = await requestPermission();
        granted = isPermissionGranted(status);
      }

      if (granted) {
        loadSound();
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível iniciar a câmera.',
      });
    } finally {
      if (mountedRef.current) {
        setPermissionChecked(true);
      }
    }
  }, [loadSound, requestPermission]);

  const requestPermissionAgain = useCallback(async () => {
    try {
      const status = await requestPermission();
      if (isPermissionGranted(status)) {
        loadSound();
        return;
      }

      Alert.alert(
        'Permissão de Câmera',
        'Para usar o leitor, habilite a câmera nas configurações do aplicativo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
        ],
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível solicitar a permissão da câmera.',
      });
    }
  }, [loadSound, requestPermission]);

  const setupBackHandler = useCallback(() => {
    const backAction = () => {
      if (modalVisible) {
        setModalVisible(false);
        setScanned(false);
        scannerLockedRef.current = false;
        return true;
      }
      return false;
    };

    backHandlerRef.current = BackHandler.addEventListener('hardwareBackPress', backAction);
  }, [modalVisible]);

  useEffect(() => {
    mountedRef.current = true;
    ensurePermission();
    startScanLineAnimation();

    return () => {
      mountedRef.current = false;
      scanLineLoopRef.current?.stop?.();
      scanLineAnim.stopAnimation();
      backHandlerRef.current?.remove?.();
      cleanupResources();
    };
  }, [cleanupResources, ensurePermission, scanLineAnim, startScanLineAnimation]);

  useEffect(() => {
    setupBackHandler();
    return () => backHandlerRef.current?.remove?.();
  }, [setupBackHandler]);

  useEffect(() => {
    if (hasPermission === true) {
      loadSound();
    }
  }, [hasPermission, loadSound]);

  useEffect(() => {
    if (!flashAvailable && torchEnabled) {
      setTorchEnabled(false);
    }
  }, [flashAvailable, torchEnabled]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ headerShown: false });
      StatusBar.setHidden(true, 'fade');
      StatusBar.setBarStyle('light-content', true);

      let immersiveInterval;

      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(COLORS.cameraBackground, true);
        const enforceImmersiveMode = async () => {
          try {
            await changeNavigationBarColor('transparent', false, false);
            await hideNavigationBar();
          } catch (error) {
            // no-op: if device doesn't support it, scanner still works
          }
        };

        enforceImmersiveMode();
        immersiveInterval = setInterval(enforceImmersiveMode, 1200);
      }

      return () => {
        StatusBar.setHidden(false, 'fade');
        if (Platform.OS === 'android') {
          if (immersiveInterval) {
            clearInterval(immersiveInterval);
          }

          showNavigationBar();
          try {
            changeNavigationBarColor('transparent', true, false);
          } catch (error) {
            // no-op
          }
        }
      };
    }, [navigation]),
  );

  const handleBarCodeScanned = useCallback(
    async (value) => {
      if (scannerLockedRef.current || scanned) {
        return;
      }

      scannerLockedRef.current = true;

      try {
        setScanned(true);
        setTorchEnabled(false);

        HapticFeedback.trigger('notificationSuccess', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });

        playBeep();
        setBarcodeData(value);
        setModalVisible(true);
      } catch (error) {
        scannerLockedRef.current = false;
      }
    },
    [playBeep, scanned],
  );

  const codeScanner = useCodeScanner({
    codeTypes: SCAN_CODE_TYPES,
    onCodeScanned: (codes) => {
      if (!codes?.length || scanned || scannerLockedRef.current) {
        return;
      }

      const candidates = codes.filter((code) => code?.value);
      if (!candidates.length) {
        return;
      }

      const selectedCode = candidates[0];

      if (!selectedCode?.value) {
        return;
      }

      handleBarCodeScanned(String(selectedCode.value).trim());
    },
  });

  const confirmBarcode = useCallback(() => {
    setModalVisible(false);
    setScanned(false);
    scannerLockedRef.current = false;
    const targetScreen = route?.params?.targetScreen;
    const paramName = route?.params?.paramName || 'barcodeData';
    const extraParams = route?.params?.extraParams || {};

    if (targetScreen) {
      navigation.navigate({
        name: targetScreen,
        params: {
          [paramName]: barcodeData,
          ...extraParams,
        },
        merge: true,
      });
      return;
    }

    navigation.navigate('AddProductScreen', { barcodeData });
  }, [barcodeData, navigation, route?.params?.extraParams, route?.params?.paramName, route?.params?.targetScreen]);

  const resetScanner = useCallback(() => {
    setModalVisible(false);
    setScanned(false);
    scannerLockedRef.current = false;
  }, []);

  const handleCameraError = useCallback((error) => {
    const cameraErrorCode = String(error?.code || '');
    if (cameraErrorCode.includes('flash-unavailable')) {
      setTorchEnabled(false);
      if (!flashWarningShownRef.current) {
        flashWarningShownRef.current = true;
        Toast.show({
          type: 'info',
          text1: 'Flash indisponível',
          text2: 'Este dispositivo não possui flash.',
        });
      }
      return;
    }

    Toast.show({
      type: 'error',
      text1: 'Erro na câmera',
      text2: 'Não foi possível iniciar o leitor.',
    });
  }, []);

  if (!permissionChecked) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera" size={52} color={COLORS.primary} />
        <Text style={styles.permissionTitle}>Preparando leitor...</Text>
        <Text style={styles.permissionText}>Solicitando permissão para acessar a câmera.</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={52} color={COLORS.danger} />
        <Text style={styles.permissionTitle}>Sem acesso à câmera</Text>
        <Text style={styles.permissionText}>
          Habilite a permissão de câmera para usar o leitor de código de barras.
        </Text>

        <TouchableOpacity style={styles.settingsButton} onPress={requestPermissionAgain}>
          <Text style={styles.settingsButtonText}>Permitir câmera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-alert" size={52} color={COLORS.warning} />
        <Text style={styles.permissionTitle}>Câmera indisponível</Text>
        <Text style={styles.permissionText}>Não encontramos uma câmera traseira neste dispositivo.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden barStyle="light-content" backgroundColor={COLORS.cameraBackground} />

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && hasPermission === true && !modalVisible}
        codeScanner={codeScanner}
        torch={flashAvailable && torchEnabled ? 'on' : 'off'}
        onError={handleCameraError}
        enableZoomGesture
      />

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />

        <View style={[styles.overlayMiddle, { height: SCAN_BOX_HEIGHT }]}>
          <View style={styles.overlaySide} />

          <View
            style={[
              styles.scannerBox,
              {
                width: SCAN_BOX_WIDTH,
                height: SCAN_BOX_HEIGHT,
                borderColor: COLORS.neonBorder,
              },
            ]}
          >
            <View style={[styles.corner, styles.cornerTL, { borderColor: COLORS.neonBorder }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: COLORS.neonBorder }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: COLORS.neonBorder }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: COLORS.neonBorder }]} />

            <Animated.View
              style={[
                styles.scanLine,
                {
                  backgroundColor: COLORS.scanLineRed,
                  shadowColor: COLORS.scanLineRed,
                  transform: [
                    {
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, SCAN_BOX_HEIGHT - 3],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>

          <View style={styles.overlaySide} />
        </View>

        <View style={styles.overlayBottom} />
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="arrow-left" size={26} color={COLORS.white} />
      </TouchableOpacity>

      <View style={styles.topRightControls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            torchEnabled && styles.controlButtonActive,
            !flashAvailable && styles.controlButtonDisabled,
          ]}
          onPress={() => {
            if (!flashAvailable) {
              if (!flashWarningShownRef.current) {
                flashWarningShownRef.current = true;
                Toast.show({
                  type: 'info',
                  text1: 'Flash indisponível',
                  text2: 'Este dispositivo não possui flash.',
                });
              }
              return;
            }

            setTorchEnabled((prev) => !prev);
          }}
          disabled={!flashAvailable}
        >
          <MaterialCommunityIcons
            name={flashAvailable ? (torchEnabled ? 'flashlight' : 'flashlight-off') : 'flash-alert'}
            size={20}
            color={COLORS.white}
          />
          <Text style={[styles.controlText, !flashAvailable && styles.controlTextDisabled]}>
            {flashAvailable ? (torchEnabled ? 'Flash ON' : 'Flash OFF') : 'Sem flash'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPanel}>
        <Text style={styles.scanText}>
          {scanned
            ? 'Código detectado'
            : 'Aponte o código em qualquer área da câmera'}
        </Text>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={resetScanner}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="barcode-scan" size={28} color={COLORS.success} />
              <Text style={styles.modalTitle}>Código detectado</Text>
            </View>

            <Text style={styles.modalData}>{barcodeData}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={confirmBarcode}>
                <MaterialCommunityIcons name="check" size={22} color={COLORS.white} />
                <Text style={styles.buttonText}>Usar código</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={resetScanner}>
                <MaterialCommunityIcons name="refresh" size={22} color={COLORS.white} />
                <Text style={styles.buttonText}>Escanear novamente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cameraBackground,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  scannerBox: {
    borderWidth: 1,
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
    shadowColor: COLORS.scanLineRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.controlBg,
    borderWidth: 1,
    borderColor: COLORS.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightControls: {
    position: 'absolute',
    top: 44,
    right: 16,
    gap: 10,
    alignItems: 'flex-end',
  },
  controlButton: {
    minWidth: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.controlBg,
    borderWidth: 1,
    borderColor: COLORS.controlBorder,
  },
  controlButtonActive: {
    backgroundColor: COLORS.controlActive,
    borderColor: COLORS.controlActive,
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  controlTextDisabled: {
    opacity: 0.9,
  },
  bottomPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: COLORS.overlayStrong,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.panelBorder,
  },
  scanText: {
    color: COLORS.white,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 0,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: COLORS.modalBackground,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.modalTitle,
  },
  modalData: {
    fontSize: 24,
    color: COLORS.success,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 22,
    letterSpacing: 1,
  },
  modalButtons: {
    gap: 10,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  confirmButton: {
    backgroundColor: COLORS.success,
  },
  cancelButton: {
    backgroundColor: COLORS.cancelButton,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.permissionBackground,
    paddingHorizontal: 24,
  },
  permissionTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.permissionTitle,
    textAlign: 'center',
  },
  permissionText: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.permissionText,
    textAlign: 'center',
    lineHeight: 22,
  },
  settingsButton: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  settingsButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default BarcodeScannerScreen;
