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
        backgroundColor: '#6b7280',
        icon: 'warning',
        status: 'Produto Vencido'
      }; 
    } else if (days === 0) {
      return { 
        number: 'VENCE',
        label: 'HOJE',
        color: '#fff',
        backgroundColor: '#dc2626',
        icon: 'error',
        status: 'Vencendo Hoje'
      }; 
    } else if (days > 0 && days <= 7) {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#ea580c',
        icon: 'schedule',
        status: `Vence em ${days} dias`
      }; 
    } else if (days > 7 && days <= 15) {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#f59e0b',
        icon: 'event',
        status: `Vence em ${days} dias`
      }; 
    } else if (days > 15 && days <= 30) {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#10b981',
        icon: 'check-circle',
        status: `Vence em ${days} dias`
      }; 
    } else {
      return { 
        number: days.toString(),
        label: 'DIAS',
        color: '#fff',
        backgroundColor: '#3b82f6',
        icon: 'check-circle',
        status: `Vence em ${days} dias`
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
      {/* Card do Produto */}
      <View style={[styles.container, isDarkMode && styles.darkContainer]}>
        {/* Status de Validade - Badge dentro do card */}
        <View style={[
          styles.statusBadge,
          { 
            backgroundColor: expirationInfo.backgroundColor,
          }
        ]}>
          <Text style={[
            styles.badgeText, 
            { color: expirationInfo.color }
          ]}>
            {expirationInfo.status === 'Produto Vencido' ? 'VENCIDO' : 
             expirationInfo.status === 'Vencendo Hoje' ? 'VENCE HOJE' :
             expirationInfo.status}
          </Text>
        </View>

        {/* Detalhes do Produto */}
        <View style={styles.productDetails}>
          {/* Informações do Produto */}
          <Text style={[styles.productName, isDarkMode && styles.darkProductName]} numberOfLines={2}>
            {product.descricao}
          </Text>

          {/* Detalhes do Produto em Grid */}
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <MaterialIcons name="code" size={17} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Código:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.codprod}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="format-list-numbered" size={17} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Qtd:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.quantidade}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="qr-code" size={17} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>EAN:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.codauxiliar}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="label" size={17} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
              <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Lote:</Text>
              <Text style={[styles.value, isDarkMode && styles.darkValue]}>{product.lote}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={17} color={isDarkMode ? '#fefeeb' : '#757575'} style={styles.icon} />
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
              <MaterialIcons name="no-photography" size={38} color={isDarkMode ? '#888' : '#bbb'} />
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
    marginVertical: 4,
  },
  
  container: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF', 
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  darkContainer: {
    backgroundColor: '#2e2e2e', 
  },
  
  productDetails: {
    flex: 1,
    marginRight: 10,
    paddingTop: 6, // Espaço para o badge
  },
  
  productName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#37474F',
    lineHeight: 20,
  },
  darkProductName: {
    color: '#e3e3e3', 
  },
  
  infoGrid: {
    flexDirection: 'column',
    gap: 2,
  },
  
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  
  icon: {
    marginRight: 6,
    width: 17,
  },
  
  label: {
    fontWeight: '600',
    fontSize: 14,
    color: '#757575',
    marginRight: 4,
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
    top: 8,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    zIndex: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  
  imageWrapper: {
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
