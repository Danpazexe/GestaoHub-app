import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { View, Animated, TouchableOpacity, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';

const BUTTON_WIDTH = 80;
const BUTTONS = [
  {
    key: 'treat',
    label: 'Tratar',
    icon: 'assignment-turned-in',
    color: '#27ae60',
  },
  {
    key: 'edit',
    label: 'Editar',
    icon: 'edit-note',
    color: '#1976D2',
  },
  {
    key: 'delete',
    label: 'Excluir',
    icon: 'delete-sweep',
    color: '#e53935',
  },
];

const SwipeableListItem = forwardRef(({
  item,
  onTreat,
  onEdit,
  onDelete,
  isDarkMode,
  children,
  onSwipeableOpen,
  onRequestClose,
}, ref) => {
  const swipeableRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    close: () => {
      if (swipeableRef.current) {
        swipeableRef.current.close();
      }
    }
  }));

  const renderRightActions = (progress, dragX) => {
    return (
      <View style={styles.actionsRow}>
        {BUTTONS.map((btn, idx) => {
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
                onPress={onPress}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={btn.icon}
                  size={btn.key === 'edit' ? 32 : btn.key === 'delete' ? 36 : 28}
                  color="#FFF"
                  style={styles.actionIcon}
                />
                <Text style={styles.actionButtonText}>{btn.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  // Só fecha ao tocar fora se estiver aberto
  const handleBackgroundPress = (e) => {
    // Só fecha se o swipe estiver aberto e o toque for fora do card
    if (isOpen && onRequestClose) {
      setTimeout(() => {
        onRequestClose();
      }, 150);
    }
  };

  const handleSwipeableOpen = () => {
    setIsOpen(true);
    if (onSwipeableOpen) onSwipeableOpen();
  };

  const handleSwipeableClose = () => {
    setIsOpen(false);
  };

  return (
    <TouchableWithoutFeedback onPress={handleBackgroundPress}>
      <View>
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
          {children}
        </Swipeable>
      </View>
    </TouchableWithoutFeedback>
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 7,
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
  actionIcon: {
    marginBottom: 2,
    alignSelf: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  buttonSeparator: {
    marginLeft: 6,
  },
});

export default SwipeableListItem; 