import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const SwipeableHistoryItem = ({ children, onDelete, isDarkMode }) => {
    const swipeableRef = useRef(null);

    const renderRightActions = (progress, dragX) => {
        const scale = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.7, 1],
            extrapolate: 'clamp',
        });

        const opacity = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });

        return (
            <View style={styles.rightActionContainer}>
                <Animated.View style={[styles.deleteButton, { transform: [{ scale }], opacity }]}>
                    <TouchableOpacity
                        style={styles.touchable}
                        onPress={() => {
                            swipeableRef.current?.close();
                            // Pequeno delay para permitir fechar a animação antes de deletar (opcional, mas ajuda na UX/estabilidade)
                            setTimeout(() => {
                                onDelete();
                            }, 300);
                        }}
                    >
                        <MaterialIcons name="delete-sweep" size={28} color="#FFF" />
                        <Text style={styles.actionText}>Excluir</Text>
                    </TouchableOpacity>
                </Animated.View>
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
    rightActionContainer: {
        width: 90,
        height: '90%',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12, // Compensar o margin do card
    },
    deleteButton: {
        backgroundColor: '#ff4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%', // Levemente menor que o card
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    touchable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 4,
    },
});

export default SwipeableHistoryItem;
