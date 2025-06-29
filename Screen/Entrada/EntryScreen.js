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
    { 
      emoji: '📦', 
      label: 'Produtos', 
      colors: ['#FF6B6B', '#FF5252', '#FF1744'],
      description: 'Gerencie seu estoque'
    },
    { 
      emoji: '📋', 
      label: 'Inventário', 
      colors: ['#4ECDC4', '#26C6DA', '#00BCD4'],
      description: 'Controle total'
    },
    { 
      emoji: '📅', 
      label: 'Validades', 
      colors: ['#FFD93D', '#FFC107', '#FF9800'],
      description: 'Acompanhe prazos'
    },
    { 
      emoji: '📈', 
      label: 'Relatórios', 
      colors: ['#6C5CE7', '#5F27CD', '#4834D4'],
      description: 'Análises detalhadas'
    },
    { 
      emoji: '🔔', 
      label: 'Alertas', 
      colors: ['#FD79A8', '#E84393', '#D63384'],
      description: 'Notificações inteligentes'
    },
    { 
      emoji: '⚡', 
      label: 'Rápido', 
      colors: ['#00B894', '#00A085', '#00A085'],
      description: 'Eficiência garantida'
    },
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
          <Text style={styles.sequenceIconDescription}>
            {icons[currentIcon].description}
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
    setTimeout(() => setIsLoading(false), 14000);
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
        blurRadius={0}
      >
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.92)',
            'rgba(240, 248, 255, 0.88)',
            'rgba(245, 247, 250, 0.90)',
            'rgba(255, 255, 255, 0.92)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Gradiente decorativo adicional */}
          <LinearGradient
            colors={[
              'rgba(116, 185, 255, 0.03)',
              'rgba(255, 255, 255, 0)',
              'rgba(255, 182, 193, 0.03)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.decorativeGradient}
          />
          
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
    paddingHorizontal: 20,
  },
  sequenceIconCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  sequenceIconText: {
    fontSize: 55,
  },
  sequenceIconLabel: {
    fontSize: 22,
    color: '#2C3E50',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
  },
  sequenceIconDescription: {
    fontSize: 13,
    color: '#7F8C8D',
    fontWeight: '400',
    textAlign: 'center',
    fontStyle: 'italic',
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
  decorativeGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default EntryScreen;
