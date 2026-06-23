import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Menu } from 'react-native-paper';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

/**
 * Componente de Menu Padronizado para o Header.
 * Segue as regras de UX: Botões quadrados com fundo semi-transparente.
 */
const HeaderMenu = ({
    visible,
    onDismiss,
    onOpen,
    items = [],
    anchorIcon = "more-vert",
    anchorColor = "#FFFFFF",
    anchorStyle = {},
    accessibilityLabel = 'Abrir menu'
}) => {
    return (
        <Menu
            visible={visible}
            onDismiss={onDismiss}
            anchor={
                <TouchableOpacity
                    onPress={onOpen}
                    style={[styles.headerButton, anchorStyle]}
                    accessibilityRole="button"
                    accessibilityLabel={accessibilityLabel}
                    accessibilityState={{ expanded: visible }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <MaterialIcons name={anchorIcon} size={24} color={anchorColor} />
                </TouchableOpacity>
            }
        >
            {items.map((item, index) => (
                <Menu.Item
                    key={item.key || index}
                    onPress={() => {
                        onDismiss();
                        item.onPress();
                    }}
                    title={item.title}
                    leadingIcon={item.icon || item.leadingIcon}
                    titleStyle={item.titleStyle}
                    disabled={item.disabled}
                />
            ))}
        </Menu>
    );
};

const styles = StyleSheet.create({
    headerButton: {
        // Compacto no visual; o alvo de toque de 44px vem do hitSlop.
        padding: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
});

export default HeaderMenu;
