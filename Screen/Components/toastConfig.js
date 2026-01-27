import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Toast, { BaseToast } from 'react-native-toast-message';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

const AnimatedIcon = ({ name, color, type }) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;
  const mounted = useRef(false);
  
  useEffect(() => {
    mounted.current = true;
    scaleValue.setValue(0);
    rotateValue.setValue(0);
    
    let animation;
    
    if (type === 'error') {
      animation = Animated.sequence([
        // Entrada com bounce
        Animated.spring(scaleValue, {
          toValue: 1.2,
          useNativeDriver: true,
          tension: 300,
          friction: 4
        }),
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 6
        }),
        // Shake sutil
        Animated.sequence([
          Animated.timing(rotateValue, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rotateValue, {
            toValue: -1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(rotateValue, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ])
      ]);
    } else if (type === 'success') {
      animation = Animated.sequence([
        // Entrada com escala
        Animated.spring(scaleValue, {
          toValue: 1.4,
          useNativeDriver: true,
          tension: 400,
          friction: 3
        }),
        // Rotação de 360 graus
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        // Retorno à escala normal
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 5
        })
      ]);
    } else {
      // Info - pulso suave
      animation = Animated.sequence([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 3
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(scaleValue, {
              toValue: 1.1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(scaleValue, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            })
          ]),
          { iterations: 3 }
        )
      ]);
    }

    if (mounted.current) {
      animation.start();
    }

    return () => {
      mounted.current = false;
      animation.stop();
    };
  }, [type, name]);

  const rotate = rotateValue.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg']
  });

  return (
    <View style={styles.iconWrapper}>
      <Animated.View 
        style={{ 
          transform: [
            { scale: scaleValue },
            { rotate: type === 'success' ? rotateValue.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg']
            }) : rotate }
          ],
        }}
      >
        <MaterialIcons name={name} size={28} color={color} />
      </Animated.View>
    </View>
  );
};

export const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={styles.successToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
      renderLeadingIcon={() => (
        <View style={styles.iconContainer}>
          <AnimatedIcon 
            key={Date.now()}
            name="check-circle" 
            color="#fff" 
            type="success" 
          />
        </View>
      )}
    />
  ),
  error: (props) => (
    <BaseToast
      {...props}
      style={styles.errorToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
      renderLeadingIcon={() => (
        <View style={styles.iconContainer}>
          <AnimatedIcon 
            key={Date.now()}
            name="error" 
            color="#fff" 
            type="error" 
          />
        </View>
      )}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={styles.infoToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
      renderLeadingIcon={() => (
        <View style={styles.iconContainer}>
          <AnimatedIcon 
            key={Date.now()}
            name="info" 
            color="#fff" 
            type="info" 
          />
        </View>
      )}
    />
  ),
};

const styles = StyleSheet.create({
  successToast: {
    backgroundColor: '#10B981',
    borderLeftColor: '#059669',
    height: 'auto',
    minHeight: 80,
    maxHeight: 160,
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderLeftWidth: 4,
  },
  errorToast: {
    backgroundColor: '#EF4444',
    borderLeftColor: '#DC2626',
    height: 'auto',
    minHeight: 80,
    maxHeight: 160,
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderLeftWidth: 4,
  },
  infoToast: {
    backgroundColor: '#3B82F6',
    borderLeftColor: '#2563EB',
    height: 'auto',
    minHeight: 80,
    maxHeight: 160,
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderLeftWidth: 4,
  },
  contentContainer: {
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: 'center',
  },
  text1: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    lineHeight: 22,
  },
  text2: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.95,
    lineHeight: 20,
    fontWeight: '400',
  },
  iconContainer: {
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  }
}); 
