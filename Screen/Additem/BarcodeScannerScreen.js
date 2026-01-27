import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  Animated,
  StatusBar,
  BackHandler
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Sound from 'react-native-sound';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import HapticFeedback from 'react-native-haptic-feedback';
import Toast from 'react-native-toast-message';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

const BarcodeScannerScreen = ({ navigation }) => {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sound, setSound] = useState();
  const [barcodeData, setBarcodeData] = useState('');
  const [scanLineAnim] = useState(new Animated.Value(0));
  const cameraRef = useRef(null);
  const [permissionChecked, setPermissionChecked] = useState(false);

  const startScanLineAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    setupScanner();
    startScanLineAnimation();
    setupBackHandler();

    return () => {
      cleanupResources();
    };
  }, []);

  const setupBackHandler = () => {
    const backAction = () => {
      if (modalVisible) {
        setModalVisible(false);
        setScanned(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  };

  

  const setupScanner = async () => {
    try {
      const status = await requestPermission();
      if (status === 'authorized') {
        loadSound();
      }
      setPermissionChecked(true);
    } catch (error) {
      setPermissionChecked(true);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível iniciar a câmera',
      });
    }
  };

  const cleanupResources = async () => {
    if (sound) {
      sound.release();
    }
  };

  const handleBarCodeScanned = async (data) => {
    if (!scanned) {
      setScanned(true);
      
      // Feedback tátil mais forte ao escanear
      HapticFeedback.trigger('notificationSuccess', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });

      await playBeep();
      setBarcodeData(data);
      setModalVisible(true);
    }
  };

  const confirmBarcode = () => {
    setModalVisible(false);
    navigation.navigate('AddProductScreen', { barcodeData });
  };

  const resetScanner = () => {
    setModalVisible(false);
    setScanned(false);
  };

  const loadSound = () => {
    Sound.setCategory('Playback');
    const beep = new Sound(require('../../assets/Sound/Beep.mp3'), (error) => {
      if (!error) {
        setSound(beep);
      }
    });
  };

  const playBeep = async () => {
    if (sound) {
      sound.stop(() => {
        sound.play();
      });
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && codes[0]?.value) {
        handleBarCodeScanned(codes[0].value);
      }
    },
  });

  if (!permissionChecked) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera" size={50} color="#666" />
        <Text style={styles.permissionText}>
          Solicitando permissão para usar a câmera...
        </Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={50} color="#666" />
        <Text style={styles.permissionText}>
          Permissão para acessar a câmera foi negada.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
      {/* Botão Voltar */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <MaterialCommunityIcons 
          name="arrow-left" 
          size={28} 
          color="#FFF" 
        />
      </TouchableOpacity>

      <View style={styles.camera}>
        {device && (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!modalVisible}
            codeScanner={codeScanner}
          />
        )}
        <View style={styles.overlay}>
          <View style={styles.unfocusedContainer}></View>
          <View style={styles.middleContainer}>
            <View style={styles.unfocusedContainer}></View>
            <View style={styles.scannerContainer}>
              <View style={styles.scanner}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        {
                          translateY: scanLineAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 250],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>

              <Text style={styles.scanText}>
                {scanned ? 'Código Detectado!' : 'Posicione o código de barras'}
              </Text>
            </View>
            <View style={styles.unfocusedContainer}></View>
          </View>
          <View style={styles.unfocusedContainer}></View>
        </View>
      </View>

      {/* Modal com novo estilo */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={resetScanner}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="barcode-scan" size={30} color="#5d7e62" />
              <Text style={styles.modalTitle}>Código Detectado</Text>
            </View>
            <Text style={styles.modalData}>{barcodeData}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmBarcode}
              >
                <MaterialCommunityIcons name="check" size={22} color="#FFF" />
                <Text style={styles.buttonText}>Confirmar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={resetScanner}
              >
                <MaterialCommunityIcons name="refresh" size={22} color="#FFF" />
                <Text style={styles.buttonText}>Escanear Novamente</Text>
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
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  unfocusedContainer: {
    flex: 1,
  },
  middleContainer: {
    flexDirection: 'row',
    height: 300,
  },
  scannerContainer: {
    flex: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanner: {
    width: 280,
    height: 250,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#5d7e62',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#5d7e62',
    shadowColor: '#5d7e62',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  scanText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  modalData: {
    fontSize: 26,
    color: '#5d7e62',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 25,
    letterSpacing: 1,
  },
  modalButtons: {
    gap: 12,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 10,
  },
  confirmButton: {
    backgroundColor: '#5d7e62',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#5d7e62',
    zIndex: 999, // Garante que o botão fique sobre outros elementos
  },
});

export default BarcodeScannerScreen;
