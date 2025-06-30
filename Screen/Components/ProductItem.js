import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Componente para exibir detalhes sobre um produto
const ProductItem = ({ product, isDarkMode }) => {
  // Função melhorada para determinar o texto e cor da validade
  const getDaysToExpirationText = (days) => {
    if (days < 0) {
      return { 
        number: 'VENCIDO',
        label: `${Math.abs(days)} dia(s)`,
        color: '#fff',
        backgroundColor: '#d32f2f',
        icon: 'warning',
        status: 'Vencido'
      }; 
    } else if (days === 0) {
      return { 
        number: 'VENCE',
        label: 'HOJE',
        color: '#fff',
        backgroundColor: '#f57c00',
        icon: 'error',
        status: 'Vence Hoje'
      }; 
    } else if (days > 0 && days <= 7) {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#ff9800',
        icon: 'schedule',
        status: 'Urgente'
      };  
    } else if (days > 7 && days <= 15) {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#ffc107',
        icon: 'schedule',
        status: 'Atenção'
      }; 
    } else if (days > 15 && days <= 30) {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#2196f3',
        icon: 'event',
        status: 'Próximo'
      }; 
    } else {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#4caf50',
        icon: 'check-circle',
        status: 'OK'
      }; 
    }
  };

  // Cálculo dos dias restantes
  const calcularDiasRestantes = () => {
    try {
      // Converte a string de data para partes
      const [dia, mes, ano] = product.validade.split('/').map(Number);
      
      // Cria as datas
      const hoje = new Date();
      const dataValidade = new Date(ano, mes - 1, dia); // mes - 1 porque em JS os meses começam do 0
      
      // Reseta as horas para comparar apenas as datas
      hoje.setHours(0, 0, 0, 0);
      dataValidade.setHours(0, 0, 0, 0);
      
      // Calcula a diferença em dias
      const diffTime = dataValidade.getTime() - hoje.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      console.error('Erro ao calcular dias restantes:', error);
      return 0;
    }
  };

  const diffDays = calcularDiasRestantes();
  const expirationInfo = getDaysToExpirationText(diffDays);

  return (
    <View style={styles.wrapper}>
      {/* Status de Validade - Badge encima do card */}
      <View style={[
        styles.statusBadge,
        { 
          backgroundColor: expirationInfo.backgroundColor,
        }
      ]}>
        <MaterialIcons 
          name={expirationInfo.icon} 
          size={16} 
          color={expirationInfo.color} 
          style={styles.badgeIcon}
        />
        <Text style={[
          styles.badgeText, 
          { color: expirationInfo.color }
        ]}>
          {expirationInfo.status === 'Vencido' ? 'VENCIDO' : 
           expirationInfo.status === 'Vence Hoje' ? 'VENCE HOJE' :
           `${expirationInfo.number} DIAS`}
        </Text>
      </View>

      {/* Card do Produto */}
      <View style={[styles.container, isDarkMode && styles.darkContainer]}>
        {/* Detalhes do Produto */}
        <View style={styles.productDetails}>
          {/* Informações do Produto */}
          <Text style={[styles.productName, isDarkMode && styles.darkProductName]} numberOfLines={2}>
            {product.descricao}
          </Text>

          {/* Detalhes do Produto em Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <MaterialIcons name="code" size={18} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Código:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.codprod}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="format-list-numbered" size={18} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Qtd:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.quantidade}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="qr-code" size={18} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>EAN:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.codauxiliar}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="label" size={18} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Lote:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.lote}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={18} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Validade:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.validade}</Text>
            </View>
          </View>
        </View>

        {/* Imagem do Produto */}
        <View style={styles.imageWrapper}>
          {product.imageUrl || product.foto ? (
            <Image
              source={{ uri: product.imageUrl || product.foto }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, styles.placeholderImage, isDarkMode && styles.placeholderImageDark]}>
              <MaterialIcons name="inventory" size={48} color={isDarkMode ? '#888' : '#bbb'} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginVertical: 8,
  },
  
  container: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF', 
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  darkContainer: {
    backgroundColor: '#2e2e2e', 
  },
  
  productDetails: {
    flex: 1,
    marginRight: 12,
  },
  
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#37474F',
    lineHeight: 22,
  },
  darkProductName: {
    color: '#e3e3e3', 
  },
  
  infoGrid: {
    flexDirection: 'column',
    gap: 3,
  },
  
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  
  icon: {
    marginRight: 8,
    width: 18,
  },
  
  label: {
    fontWeight: '600',
    fontSize: 14,
    color: '#757575',
    marginRight: 6,
  },
  darkLabel: {
    color: '#b0b0b0', 
  },
  
  value: {
    fontSize: 14,
    color: '#424242',
    fontWeight: '500',
  },
  darkValue: {
    color: '#e0e0e0', 
  },
  
  statusBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 10,
  },
  badgeIcon: {
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  imageWrapper: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f3f3',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
  },
  placeholderImage: {
    backgroundColor: '#f3f3f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImageDark: {
    backgroundColor: '#444',
    borderColor: '#222',
  },
});

export default ProductItem;
