import React, { useRef } from 'react';
import { View, Animated, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';

const BUTTON_WIDTH = 72;
const BUTTONS = [
  {
    key: 'treat',
    label: 'Tratar',
    icon: 'check-circle',
    color: '#4CAF50',
  },
  {
    key: 'edit',
    label: 'Editar',
    icon: 'edit',
    color: '#1976D2',
  },
  {
    key: 'delete',
    label: 'Excluir',
    icon: 'delete-forever',
    color: '#D32F2F',
  },
];

const SwipeableListItem = ({
  item,
  onTreat,
  onEdit,
  onDelete,
  isDarkMode,
  children,
}) => {
  const swipeableRef = useRef(null);

  const renderRightActions = (progress, dragX) => {
    // Cada botão tem sua própria animação de escala e opacidade
    return (
      <View style={styles.actionsRow}>
        {BUTTONS.map((btn, idx) => {
          // Animação de escala e opacidade para cada botão
          const inputRange = [0, 0.5 + idx * 0.1, 1];
          const scale = progress.interpolate({
            inputRange,
            outputRange: [0.5, 0.8, 1],
            extrapolate: 'clamp',
          });
          const opacity = progress.interpolate({
            inputRange,
            outputRange: [0, 0.5, 1],
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
                { backgroundColor: btn.color, width: BUTTON_WIDTH },
                { transform: [{ scale }], opacity },
                btn.key === 'edit' && styles.editButton,
                btn.key === 'delete' && styles.deleteButton,
              ]}
            >
              <TouchableOpacity
                style={styles.actionTouchable}
                onPress={onPress}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={btn.icon}
                  size={btn.key === 'edit' ? 28 : btn.key === 'delete' ? 30 : 24}
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

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
      useNativeAnimations
    >
      {children}
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    paddingRight: 4,
  },
  actionButton: {
    height: '90%',
    borderRadius: 12,
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  actionIcon: {
    marginBottom: 4,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    // Personalize aqui se quiser
  },
  deleteButton: {
    // Personalize aqui se quiser
  },
});

export default SwipeableListItem; 