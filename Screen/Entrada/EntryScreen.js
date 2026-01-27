import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ImageBackground,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';
import { version } from '../../package.json';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#40444c',
  primaryDeep: '#2f333a',
  secondary: '#f4cc84',
  text: '#40444c',
  textSoft: 'rgba(64, 68, 76, 0.78)',
  overlay: '#ffffff',
};

const EntryScreen = () => {
  const navigation = useNavigation();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  const startAnimation = useMemo(
    () =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    [opacity, translateY],
  );

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    StatusBar.setBarStyle('dark-content');

    startAnimation.start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => navigation.navigate('LoginScreen'));
    }, 3200);

    return () => clearTimeout(timer);
  }, [navigation, opacity, startAnimation]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/Image/FUNDOAPP.png')}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Animatable.Image
            animation="fadeInUp"
            duration={900}
            delay={100}
            source={require('../../assets/Image/LOGO.png')}
            style={styles.logo}
          />

          <Animatable.View
            animation="fadeIn"
            duration={700}
            delay={220}
            style={styles.brandLine}
          />

          <Animatable.Text
            animation="fadeInUp"
            duration={800}
            delay={180}
            style={styles.title}
          >
            Gestão Hub
          </Animatable.Text>

          <Animatable.Text
            animation="fadeInUp"
            duration={800}
            delay={260}
            style={styles.subtitle}
          >
            Simples. Rápido. Organizado.
          </Animatable.Text>

          <View style={styles.footer}>
            <Text style={styles.version}>v{version}</Text>
            <Text style={styles.byline}>Daniel Paz</Text>
          </View>
        </Animated.View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDeep,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: height * 0.08,
    paddingBottom: 96,
  },
  logo: {
    width: Math.min(width * 0.56, 230),
    height: Math.min(width * 0.56, 230),
    resizeMode: 'contain',
    marginBottom: 22,
  },
  brandLine: {
    width: 132,
    height: 4,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginBottom: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSoft,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  version: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.secondary,
    letterSpacing: 0.3,
  },
  byline: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSoft,
  },
});

export default EntryScreen;
