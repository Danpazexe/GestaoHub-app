import React, { useRef, useImperativeHandle, forwardRef, useState, useMemo } from 'react';
import { View, Animated, TouchableOpacity, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import haptics from '../../utils/haptics';

const BUTTON_WIDTH = 76;

const SwipeableListItem = forwardRef(({
  item,
  onLocation,
  onTreat,
  onEdit,
  onDelete,
  showLocationAction = false,
  isDarkMode,
  children,
  onSwipeableOpen,
  onSwipeableClose,
}, ref) => {
  const swipeableRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const actionButtons = useMemo(() => {
    const buttons = [];

    if (showLocationAction) {
      buttons.push({
        key: 'location',
        label: 'Local',
        icon: 'map-marker-path',
        color: '#7c3aed',
      });
    }

    buttons.push(
      {
        key: 'treat',
        label: 'Tratar',
        icon: 'archive-check-outline',
        color: '#16a34a',
      },
      {
        key: 'edit',
        label: 'Editar',
        icon: 'archive-edit-outline',
        color: '#2563eb',
      },
      {
        key: 'delete',
        label: 'Excluir',
        icon: 'archive-remove-outline',
        color: '#dc2626',
      },
    );

    return buttons;
  }, [showLocationAction]);

  // deps [] mantém a identidade do handle estável entre renders — sem isso o
  // objeto era recriado a cada render e a comparação de "linha aberta" no pai
  // confundia a mesma linha com outra.
  useImperativeHandle(ref, () => ({
    close: () => {
      swipeableRef.current?.close();
    },
  }), []);

  const renderRightActions = (progress, dragX) => {
    return (
      <View style={styles.actionsRow}>
        {actionButtons.map((btn, idx) => {
          const inputRange = [0, 0.5 + idx * 0.1, 1];
          const scale = progress.interpolate({
            inputRange,
            outputRange: [0.7, 0.9, 1],
            extrapolate: 'clamp',
          });
          const opacity = progress.interpolate({
            inputRange,
            outputRange: [0, 0.7, 1],
            extrapolate: 'clamp',
          });
          let onPress;
          if (btn.key === 'location') onPress = () => onLocation?.(item);
          if (btn.key === 'treat') onPress = () => onTreat(item);
          if (btn.key === 'edit') onPress = () => onEdit(item);
          if (btn.key === 'delete') onPress = () => onDelete(item);
          return (
            <Animated.View
              key={btn.key}
              style={[
                styles.actionButton,
                { width: BUTTON_WIDTH, backgroundColor: btn.color, transform: [{ scale }], opacity },
                idx !== 0 && styles.buttonSeparator,
              ]}
            >
              <TouchableOpacity
                style={styles.actionTouchable}
                onPress={() => {
                  haptics.selection();
                  swipeableRef.current?.close();
                  setTimeout(() => {
                    onPress?.();
                  }, 120);
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`${btn.label} produto`}
              >
                <View style={styles.actionIconCircle}>
                  <MaterialCommunityIcons name={btn.icon} size={24} color="#FFF" />
                </View>
                <Text style={styles.actionButtonText}>{btn.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  // Fecha a linha ao tocar no card quando ele já está aberto. O overlay só é
  // montado com isOpen=true, então NUNCA captura o fim do gesto de abertura
  // (era essa captura, por um TouchableWithoutFeedback envolvendo o Swipeable,
  // que fechava a linha sozinha ao puxar).
  const handleOverlayPress = () => {
    swipeableRef.current?.close();
  };

  const handleSwipeableOpen = () => {
    setIsOpen(true);
    if (onSwipeableOpen) onSwipeableOpen();
  };

  const handleSwipeableClose = () => {
    setIsOpen(false);
    if (onSwipeableClose) onSwipeableClose();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
      useNativeAnimations
      onSwipeableOpen={handleSwipeableOpen}
      onSwipeableClose={handleSwipeableClose}
    >
      <View>
        {children}
        {isOpen ? (
          <TouchableWithoutFeedback
            onPress={handleOverlayPress}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.closeOverlay} />
          </TouchableWithoutFeedback>
        ) : null}
      </View>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    paddingRight: 6,
  },
  actionButton: {
    height: '88%',
    borderRadius: 18,
    marginHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  actionTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  buttonSeparator: {
    marginLeft: 6,
  },
  // Captador de toque que aparece só com a linha aberta, para fechá-la ao
  // tocar no card. Não interfere no gesto de arrastar (RNGH distingue
  // toque de arraste) nem cobre os botões de ação (que ficam à direita).
  closeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default SwipeableListItem; 
