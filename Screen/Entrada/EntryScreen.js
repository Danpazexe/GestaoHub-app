import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, ImageBackground, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import appInfo from '../../app.json';

const { width, height } = Dimensions.get('window');

// Componente de sequência de ícones simplificado
const SystemIconsSequence = () => {
  const [currentIcon, setCurrentIcon] = useState(0);
  const [showLogo, setShowLogo] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const icons = [
    { emoji: '📦', label: 'Produtos', colors: ['#E74C3C', '#C0392B', '#A93226'] },
    { emoji: '📋', label: 'Inventário', colors: ['#F39C12', '#E67E22', '#D35400'] },
    { emoji: '📅', label: 'Validades', colors: ['#27AE60', '#229954', '#1E8449'] },
    { emoji: '📊', label: 'Relatórios', colors: ['#9B59B6', '#8E44AD', '#7D3C98'] },
    { emoji: '🔔', label: 'Alertas', colors: ['#E67E22', '#D35400', '#BA4A00'] },
  ];

  useEffect(() => {
    const iconInterval = setInterval(() => {
      setCurrentIcon(prev => {
        if (prev < icons.length - 1) {
          return prev + 1;
        } else {
          clearInterval(iconInterval);
          setTimeout(() => setShowLogo(true), 800);
          return prev;
        }
      });
    }, 1000);

    return () => clearInterval(iconInterval);
  }, []);

  useEffect(() => {
    if (showLogo) {
      setTimeout(() => setShowTitle(true), 1500);
    }
  }, [showLogo]);

  useEffect(() => {
    if (showTitle) {
      setTimeout(() => setShowWelcome(true), 1200);
    }
  }, [showTitle]);

  return (
    <View style={styles.sequenceContainer}>
      {!showLogo ? (
        <Animatable.View 
          key={currentIcon}
          animation="zoomIn"
          duration={600}
          style={styles.sequenceIconContainer}
        >
          <LinearGradient
            colors={icons[currentIcon].colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sequenceIconCircle}
          >
            <Text style={styles.sequenceIconText}>{icons[currentIcon].emoji}</Text>
          </LinearGradient>
          <Text style={styles.sequenceIconLabel}>
            {icons[currentIcon].label}
          </Text>
        </Animatable.View>
      ) : (
        <Animatable.View 
          animation="zoomIn"
          duration={800}
          style={styles.finalLogoContainer}
        >
          <Animatable.Image
            animation="fadeIn"
            duration={1200}
            source={require('../../assets/Image/LOGO.png')}
            style={styles.finalLogo}
          />
          {showTitle && (
            <Animatable.Text 
              animation="fadeInUp"
              duration={2000}
              easing="ease-out"
              style={styles.finalLogoText}
            >
              Gestão de Validades
            </Animatable.Text>
          )}
          {showWelcome && (
            <Animatable.Text 
              animation="fadeInUp"
              duration={1500}
              easing="ease-out"
              style={styles.welcomeText}
            >
              Seja bem-vindo!
            </Animatable.Text>
          )}
        </Animatable.View>
      )}
    </View>
  );
};

const EntryScreen = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [showSequence, setShowSequence] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    // Animação inicial simples
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Sequência simplificada
    setTimeout(() => setShowSequence(true), 1000);
    setTimeout(() => setIsLoading(false), 12000);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate('LoginScreen');
      });
    }
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/Image/FUNDOAPP.png')}
        style={styles.backgroundImage}
        blurRadius={0.5}
      >
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.92)',
            'rgba(240, 248, 255, 0.95)',
            'rgba(255, 255, 255, 0.92)',
          ]}
          style={styles.gradient}
        >
          <Animated.View 
            style={[
              styles.content, 
              { opacity: fadeAnim }
            ]}
          >
            {/* Sequência de ícones centralizada */}
            {showSequence && (
              <SystemIconsSequence />
            )}

            {/* Informação simples */}
            <View style={styles.infoContainer}>
              <Text style={styles.versionInfo}>
                v{appInfo.expo.version}
              </Text>
              <Text style={styles.developerInfo}>
                Desenvolvido por Daniel Paz
              </Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
  },
  sequenceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  sequenceIconContainer: {
    alignItems: 'center',
  },
  sequenceIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  sequenceIconText: {
    fontSize: 50,
  },
  sequenceIconLabel: {
    fontSize: 20,
    color: '#2C3E50',
    fontWeight: '600',
    textAlign: 'center',
  },
  finalLogoContainer: {
    alignItems: 'center',
  },
  finalLogo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
    marginBottom: 40,
  },
  finalLogoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2C3E50',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
    textAlign: 'center',
    marginTop: 20,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  versionInfo: {
    fontSize: 12,
    color: '#95A5A6',
    fontWeight: '500',
  },
  developerInfo: {
    fontSize: 11,
    color: '#BDC3C7',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default EntryScreen;
