import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Modal, FlatList, Switch, Image } from 'react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import ReactNativeBlobUtil from 'react-native-blob-util';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { createScreenHeaderTemplate, createHeaderTitleTemplate } from '../../../components/ScreenLayout';
import { validadePdfTemplate } from '../../../assets/templates/validadePdfTemplate';
import { readStoredUserName } from '../../../services/userSessionStorageService';
import { readValidadeProductsCache } from '../storage/validadeProductsStorage';

const PdfScreen = ({ isDarkMode }) => {
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const [orderBy, setOrderBy] = useState('validade');
  const [orderDirection, setOrderDirection] = useState('asc');
  const [filterValidade, setFilterValidade] = useState('todos'); // '7', '15', 'todos'
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [mostrarLegenda, setMostrarLegenda] = useState(true);

  const orderOptions = [
    { label: 'Validade', value: 'validade' },
    { label: 'Quantidade', value: 'quantidade' },
  ];

  useEffect(() => {
    navigation.setOptions({
      ...createScreenHeaderTemplate({
        isDarkMode,
        lightHeaderColor: '#d7263d',
        darkHeaderColor: '#d7263d',
        tintColor: '#FFFFFF',
      }),
      headerTitle: () =>
        createHeaderTitleTemplate({
          title: 'Exportar e Compartilhar PDF',
          iconName: 'picture-as-pdf',
          tintColor: '#FFFFFF',
        }),
    });
  }, [navigation, isDarkMode]);

  const getImageBase64 = async (uri) => {
    if (!uri) return null;
    if (uri.startsWith('file://')) {
      try {
        const path = uri.replace('file://', '');
        const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
        let ext = uri.split('.').pop().toLowerCase();
        let mime = 'image/jpeg';
        if (ext === 'png') mime = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        return `data:${mime};base64,${base64}`;
      } catch (e) {
        return null;
      }
    }
    return uri; // http(s) ou base64 já pronto
  };

  const getLogoBase64 = async () => {
    try {
      const assetSource = Image.resolveAssetSource(require('../../../../assets/Image/LOGOCOMFRASE.png'));
      const assetUri = assetSource?.uri;
      if (!assetUri) return null;
      const path = assetUri.startsWith('file://') ? assetUri.replace('file://', '') : assetUri;
      const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
      return `data:image/png;base64,${base64}`;
    } catch (e) {
      return null;
    }
  };

  // Função robusta para converter validade para Date
  function parseValidade(str) {
    if (!str) return new Date(0);
    if (str.includes('/')) {
      const [dia, mes, ano] = str.split('/').map(Number);
      return new Date(ano, mes - 1, dia);
    }
    return new Date(str);
  }

  const loadPdfProducts = async () => {
    let produtos = await readValidadeProductsCache();

    if (filterValidade === '7') {
      produtos = produtos.filter((p) => {
        const dataValidade = parseValidade(p.validade);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataValidade.setHours(0, 0, 0, 0);
        const diff = (dataValidade - hoje) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      });
    } else if (filterValidade === '15') {
      produtos = produtos.filter((p) => {
        const dataValidade = parseValidade(p.validade);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataValidade.setHours(0, 0, 0, 0);
        const diff = (dataValidade - hoje) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 15;
      });
    }

    return produtos.sort((a, b) => {
      if (orderBy === 'validade') {
        const dataA = parseValidade(a.validade);
        const dataB = parseValidade(b.validade);
        return orderDirection === 'asc' ? dataA - dataB : dataB - dataA;
      }
      if (orderBy === 'quantidade') {
        return orderDirection === 'asc'
          ? a.quantidade - b.quantidade
          : b.quantidade - a.quantidade;
      }
      return 0;
    });
  };

  const loadCurrentUserName = async () => {
    return readStoredUserName('---');
  };

  // Função para gerar e compartilhar o PDF
  const compartilharPDF = async (mostrarLegendaAtual) => {
    setLoading(true);
    try {
      const produtos = await loadPdfProducts();
      const userName = await loadCurrentUserName();

      const produtosComImagens = await Promise.all(produtos.map(async (prod) => {
        let img = prod.imageUrl || prod.foto || '';
        let imgBase64 = await getImageBase64(img);
        return {
          ...prod,
          imgBase64,
        };
      }));

      let logoBase64 = await getLogoBase64();
      if (!logoBase64) logoBase64 = '';
      
      const totalItens = produtosComImagens.length;
      const dataEmissao = new Date().toLocaleDateString('pt-BR');

      // Carregar template HTML
      const htmlTemplate = validadePdfTemplate;

      // Gerar HTML dos produtos
      const produtosHtml = produtosComImagens.map((prod, idx) => {
        // Calcular dias para vencer
        let diasRestantes = 0;
        try {
          const hoje = new Date();
          hoje.setHours(0,0,0,0);
          let dataValidade = prod.validade ? new Date(prod.validade) : null;
          if (prod.validade && prod.validade.includes('/')) {
            const [dia, mes, ano] = prod.validade.split('/').map(Number);
            dataValidade = new Date(ano, mes-1, dia);
          }
          if (dataValidade) {
            dataValidade.setHours(0,0,0,0);
            diasRestantes = Math.floor((dataValidade - hoje) / (1000*60*60*24));
          }
        } catch(e) {}
        
        // Definir cor do status
        let cor = '';
        if (diasRestantes < 0) { cor = '#6b7280'; }
        else if (diasRestantes === 0) { cor = '#dc2626'; }
        else if (diasRestantes > 0 && diasRestantes <= 7) { cor = '#ea580c'; }
        else if (diasRestantes > 7 && diasRestantes <= 15) { cor = '#f59e0b'; }
        else if (diasRestantes > 15 && diasRestantes <= 30) { cor = '#10b981'; }
        else { cor = '#3b82f6'; }
        
        // Se mostrarLegendaAtual for true, colorir a linha, senão fundo branco
        const styleLinha = mostrarLegendaAtual ? `background:${cor}22;` : '';
        
        return `
        <tr style="${styleLinha}">
          <td>${idx+1}</td>
          <td>${prod.codprod || ''}</td>
          <td>${prod.codauxiliar || ''}</td>
          <td>${prod.descricao || ''}</td>
          <td>${prod.lote || ''}</td>
          <td>${prod.quantidade || ''}</td>
          <td>${prod.validade ? (prod.validade.includes('/') ? prod.validade : new Date(prod.validade).toLocaleDateString('pt-BR')) : ''}</td>
          <td>${prod.imgBase64 ? `<img src="${prod.imgBase64}" width="60" height="50" />` : '<span style="color:#aaa">Sem imagem</span>'}</td>
        </tr>
        `;
      }).join('');

      // Gerar HTML da legenda
      const legendaHtml = mostrarLegenda ? `
        <div style="margin-top:18px;text-align:center;font-size:0.98em;display:flex;flex-wrap:nowrap;gap:18px;align-items:center;justify-content:center;">
          <b style="margin-right:18px;">Legenda de Status:</b>
          <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#6b7280;border-radius:4px;margin-right:6px;"></span>VENCIDO</span>
          <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#dc2626;border-radius:4px;margin-right:6px;"></span>VENCE HOJE</span>
          <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#ea580c;border-radius:4px;margin-right:6px;"></span>1-7 dias</span>
          <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#f59e0b;border-radius:4px;margin-right:6px;"></span>8-15 dias</span>
          <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#10b981;border-radius:4px;margin-right:6px;"></span>16-30 dias</span>
          <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#3b82f6;border-radius:4px;margin-right:6px;"></span>31+ dias</span>
        </div>
      ` : '';

      // Substituir placeholders no template
      let html = htmlTemplate
        .replace('{{LOGO_HTML}}', logoBase64 ? `<img src="${logoBase64}" class="logo" />` : '')
        .replace('{{DATA_EMISSAO}}', dataEmissao)
        .replace('{{TOTAL_ITENS}}', totalItens)
        .replace('{{USER_NAME}}', userName)
        .replace('{{FILTRO_APLICADO}}', filterValidade === '7' ? 'Até 7 dias' : filterValidade === '15' ? 'Até 15 dias' : 'Todos os produtos')
        .replace('{{ORDENACAO}}', `${orderBy === 'validade' ? 'Validade' : 'Quantidade'} ${orderDirection === 'asc' ? '(Crescente)' : '(Decrescente)'}`)
        .replace('{{LEGENDA_STATUS}}', mostrarLegendaAtual ? 'Incluída' : 'Não incluída')
        .replace('{{PRODUTOS_HTML}}', produtosHtml)
        .replace('{{LEGENDA_HTML}}', legendaHtml);

      const { filePath } = await RNHTMLtoPDF.convert({
        html,
        fileName: `relatorio-${Date.now()}`,
        directory: 'Documents',
        width: 595.28,
        height: 841.89,
      });
      const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      await Share.open({
        url: fileUrl,
        type: 'application/pdf',
        title: 'Compartilhar PDF',
      });
    } catch (error) {
      Alert.alert('Erro ao compartilhar PDF', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStyles = (isDarkMode) => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: isDarkMode ? '#181A20' : '#e8f0ff',
    },
    card: {
      backgroundColor: isDarkMode ? '#23262F' : '#f9fbff',
      borderRadius: 22,
      padding: 32,
      alignItems: 'center',
      width: '100%',
      maxWidth: 440,
      shadowColor: isDarkMode ? '#000000' : '#B0B3B8',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0.08 : 0.13,
      shadowRadius: 8,
      elevation: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDarkMode ? '#FFFFFF' : '#B0B3B8',
      marginBottom: 10,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    desc: {
      fontSize: 16,
      color: isDarkMode ? '#B0B3B8' : '#B0B3B8',
      marginBottom: 28,
      textAlign: 'center',
      lineHeight: 22,
    },
    button: {
      backgroundColor: '#d7263d',
      paddingVertical: 16,
      paddingHorizontal: 36,
      borderRadius: 12,
      elevation: 4,
      marginTop: 10,
      width: '100%',
      alignItems: 'center',
      shadowColor: '#d7263d',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
    },
    buttonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDarkMode ? '#FFFFFF' : '#B0B3B8',
      marginBottom: 10,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    exportButton: {
      backgroundColor: '#d7263d',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 10,
      shadowColor: isDarkMode ? '#FFFFFF' : '#B0B3B8',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.10,
      shadowRadius: 2,
      minWidth: 180,
      alignSelf: 'center',
    },
    exportButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
  });

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <MaterialCommunityIcons name="file-pdf-box" size={64} color="#d7263d" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Exportar Relatório de Validades</Text>
        <Text style={styles.desc}>Gere um PDF com os produtos filtrados e ordenados como preferir.</Text>
        <View style={{ padding: 18 }}>
          <Text style={styles.sectionTitle}>Ordenar por</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={{
                backgroundColor: orderBy === 'validade' ? '#d7263d' : (isDarkMode ? '#23283a' : '#fff'),
                borderWidth: 2,
                borderColor: orderBy === 'validade' ? '#d7263d' : (isDarkMode ? '#444' : '#ccc'),
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 18,
                marginRight: 8,
                shadowColor: orderBy === 'validade' ? '#d7263d' : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: orderBy === 'validade' ? 0.15 : 0,
                shadowRadius: 2,
              }}
              onPress={() => setOrderBy('validade')}
            >
              <Text style={{
                color: orderBy === 'validade' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222'),
                fontWeight: orderBy === 'validade' ? 'bold' : 'normal',
                fontSize: 14
              }}>
                Validade
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: orderBy === 'quantidade' ? '#d7263d' : (isDarkMode ? '#23283a' : '#fff'),
                borderWidth: 2,
                borderColor: orderBy === 'quantidade' ? '#d7263d' : (isDarkMode ? '#444' : '#ccc'),
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 18,
                shadowColor: orderBy === 'quantidade' ? '#d7263d' : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: orderBy === 'quantidade' ? 0.15 : 0,
                shadowRadius: 2,
              }}
              onPress={() => setOrderBy('quantidade')}
            >
              <Text style={{
                color: orderBy === 'quantidade' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222'),
                fontWeight: orderBy === 'quantidade' ? 'bold' : 'normal',
                fontSize: 14
              }}>
                Quantidade
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>Direção</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: orderDirection === 'asc' ? '#d7263d' : (isDarkMode ? '#23283a' : '#fff'),
                borderWidth: 2,
                borderColor: orderDirection === 'asc' ? '#d7263d' : (isDarkMode ? '#444' : '#ccc'),
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 16,
                marginRight: 8,
                shadowColor: orderDirection === 'asc' ? '#d7263d' : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: orderDirection === 'asc' ? 0.15 : 0,
                shadowRadius: 2,
              }}
              onPress={() => setOrderDirection('asc')}
            >
              <MaterialCommunityIcons name="arrow-up" size={20} color={orderDirection === 'asc' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222')} />
              <Text style={{ color: orderDirection === 'asc' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222'), marginLeft: 8, fontWeight: orderDirection === 'asc' ? 'bold' : 'normal', fontSize: 14 }}>Crescente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: orderDirection === 'desc' ? '#d7263d' : (isDarkMode ? '#23283a' : '#fff'),
                borderWidth: 2,
                borderColor: orderDirection === 'desc' ? '#d7263d' : (isDarkMode ? '#444' : '#ccc'),
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 16,
                shadowColor: orderDirection === 'desc' ? '#d7263d' : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: orderDirection === 'desc' ? 0.15 : 0,
                shadowRadius: 2,
              }}
              onPress={() => setOrderDirection('desc')}
            >
              <MaterialCommunityIcons name="arrow-down" size={20} color={orderDirection === 'desc' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222')} />
              <Text style={{ color: orderDirection === 'desc' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222'), marginLeft: 8, fontWeight: orderDirection === 'desc' ? 'bold' : 'normal', fontSize: 14 }}>Decrescente</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>Filtrar por validade</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={{
                backgroundColor: filterValidade === '7' ? '#d7263d' : (isDarkMode ? '#23283a' : '#fff'),
                borderWidth: 2,
                borderColor: filterValidade === '7' ? '#d7263d' : (isDarkMode ? '#444' : '#ccc'),
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 16,
                marginRight: 8,
                shadowColor: filterValidade === '7' ? '#d7263d' : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: filterValidade === '7' ? 0.15 : 0,
                shadowRadius: 2,
              }}
              onPress={() => setFilterValidade('7')}
            >
              <Text style={{
                color: filterValidade === '7' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222'),
                fontWeight: filterValidade === '7' ? 'bold' : 'normal',
                fontSize: 14
              }}>
                Até 7 dias
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: filterValidade === '15' ? '#d7263d' : (isDarkMode ? '#23283a' : '#fff'),
                borderWidth: 2,
                borderColor: filterValidade === '15' ? '#d7263d' : (isDarkMode ? '#444' : '#ccc'),
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 16,
                marginRight: 8,
                shadowColor: filterValidade === '15' ? '#d7263d' : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: filterValidade === '15' ? 0.15 : 0,
                shadowRadius: 2,
              }}
              onPress={() => setFilterValidade('15')}
            >
              <Text style={{
                color: filterValidade === '15' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222'),
                fontWeight: filterValidade === '15' ? 'bold' : 'normal',
                fontSize: 14
              }}>
                Até 15 dias
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: filterValidade === 'todos' ? '#d7263d' : (isDarkMode ? '#23283a' : '#fff'),
                borderWidth: 2,
                borderColor: filterValidade === 'todos' ? '#d7263d' : (isDarkMode ? '#444' : '#ccc'),
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 16,
                shadowColor: filterValidade === 'todos' ? '#d7263d' : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: filterValidade === 'todos' ? 0.15 : 0,
                shadowRadius: 2,
              }}
              onPress={() => setFilterValidade('todos')}
            >
              <Text style={{
                color: filterValidade === 'todos' ? '#fff' : (isDarkMode ? '#FFFFFF' : '#222'),
                fontWeight: filterValidade === 'todos' ? 'bold' : 'normal',
                fontSize: 14
              }}>
                Todos
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
            <Switch
              value={mostrarLegenda}
              onValueChange={setMostrarLegenda}
              trackColor={{ false: '#ccc', true: '#d7263d' }}
              thumbColor={mostrarLegenda ? '#fff' : '#888'}
              ios_backgroundColor="#ccc"
              style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
            />
            <Text style={{ marginLeft: 10, color: isDarkMode ? '#FFFFFF' : '#222' }}>Incluir legenda de status no PDF</Text>
          </View>
          <TouchableOpacity
            style={[
              {
                backgroundColor: loading ? '#4666b2' : '#294380',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 28,
                height: 54,
                minWidth: 210,
                paddingHorizontal: 28,
                marginTop: 22,
                alignSelf: 'center',
                shadowColor: '#294380',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.10,
                shadowRadius: 6,
                elevation: 3,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            activeOpacity={0.85}
            onPress={async () => {
              setLoading(true);
              try {
                const produtos = await loadPdfProducts();
                const userName = await loadCurrentUserName();
                
                const produtosComImagens = await Promise.all(produtos.map(async (prod) => {
                  let img = prod.imageUrl || prod.foto || '';
                  let imgBase64 = await getImageBase64(img);
                  return {
                    ...prod,
                    imgBase64,
                  };
                }));
                
                let logoBase64 = await getLogoBase64();
                if (!logoBase64) logoBase64 = '';
                
                const totalItens = produtosComImagens.length;
                const dataEmissao = new Date().toLocaleDateString('pt-BR');

                // Carregar template HTML
                const htmlTemplate = validadePdfTemplate;

                // Gerar HTML dos produtos
                const produtosHtml = produtosComImagens.map((prod, idx) => {
                  // Calcular dias para vencer
                  let diasRestantes = 0;
                  try {
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    let dataValidade = prod.validade ? new Date(prod.validade) : null;
                    if (prod.validade && prod.validade.includes('/')) {
                      const [dia, mes, ano] = prod.validade.split('/').map(Number);
                      dataValidade = new Date(ano, mes-1, dia);
                    }
                    if (dataValidade) {
                      dataValidade.setHours(0,0,0,0);
                      diasRestantes = Math.floor((dataValidade - hoje) / (1000*60*60*24));
                    }
                  } catch(e) {}
                  
                  // Definir cor do status
                  let cor = '';
                  if (diasRestantes < 0) { cor = '#6b7280'; }
                  else if (diasRestantes === 0) { cor = '#dc2626'; }
                  else if (diasRestantes > 0 && diasRestantes <= 7) { cor = '#ea580c'; }
                  else if (diasRestantes > 7 && diasRestantes <= 15) { cor = '#f59e0b'; }
                  else if (diasRestantes > 15 && diasRestantes <= 30) { cor = '#10b981'; }
                  else { cor = '#3b82f6'; }
                  
                  // Se mostrarLegendaAtual for true, colorir a linha, senão fundo branco
                  const styleLinha = mostrarLegenda ? `background:${cor}22;` : '';
                  
                  return `
                  <tr style="${styleLinha}">
                    <td>${idx+1}</td>
                    <td>${prod.codprod || ''}</td>
                    <td>${prod.codauxiliar || ''}</td>
                    <td>${prod.descricao || ''}</td>
                    <td>${prod.lote || ''}</td>
                    <td>${prod.quantidade || ''}</td>
                    <td>${prod.validade ? (prod.validade.includes('/') ? prod.validade : new Date(prod.validade).toLocaleDateString('pt-BR')) : ''}</td>
                    <td>${prod.imgBase64 ? `<img src="${prod.imgBase64}" width="60" height="50" />` : '<span style="color:#aaa">Sem imagem</span>'}</td>
                  </tr>
                  `;
                }).join('');

                // Gerar HTML da legenda
                const legendaHtml = mostrarLegenda ? `
                  <div style="margin-top:18px;text-align:center;font-size:0.98em;display:flex;flex-wrap:nowrap;gap:18px;align-items:center;justify-content:center;">
                    <b style="margin-right:18px;">Legenda de Status:</b>
                    <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#6b7280;border-radius:4px;margin-right:6px;"></span>VENCIDO</span>
                    <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#dc2626;border-radius:4px;margin-right:6px;"></span>VENCE HOJE</span>
                    <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#ea580c;border-radius:4px;margin-right:6px;"></span>1-7 dias</span>
                    <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#f59e0b;border-radius:4px;margin-right:6px;"></span>8-15 dias</span>
                    <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#10b981;border-radius:4px;margin-right:6px;"></span>16-30 dias</span>
                    <span style="display:inline-flex;align-items:center;"><span style="display:inline-block;width:18px;height:18px;background:#3b82f6;border-radius:4px;margin-right:6px;"></span>31+ dias</span>
                  </div>
                ` : '';

                // Substituir placeholders no template
                let html = htmlTemplate
                  .replace('{{LOGO_HTML}}', logoBase64 ? `<img src="${logoBase64}" class="logo" />` : '')
                  .replace('{{DATA_EMISSAO}}', dataEmissao)
                  .replace('{{TOTAL_ITENS}}', totalItens)
                  .replace('{{USER_NAME}}', userName)
                  .replace('{{FILTRO_APLICADO}}', filterValidade === '7' ? 'Até 7 dias' : filterValidade === '15' ? 'Até 15 dias' : 'Todos os produtos')
                  .replace('{{ORDENACAO}}', `${orderBy === 'validade' ? 'Validade' : 'Quantidade'} ${orderDirection === 'asc' ? '(Crescente)' : '(Decrescente)'}`)
                  .replace('{{LEGENDA_STATUS}}', mostrarLegenda ? 'Incluída' : 'Não incluída')
                  .replace('{{PRODUTOS_HTML}}', produtosHtml)
                  .replace('{{LEGENDA_HTML}}', legendaHtml);

                const { filePath } = await RNHTMLtoPDF.convert({
                  html,
                  fileName: `relatorio-${Date.now()}`,
                  directory: 'Documents',
                  width: 595.28,
                  height: 841.89,
                });
                setLoading(false);
                const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
                navigation.navigate('PdfViewerScreen', { pdfUri: fileUrl });
              } catch (error) {
                setLoading(false);
                Alert.alert('Erro ao visualizar PDF', error.message);
              }
            }}
            disabled={loading}
          >
            <MaterialCommunityIcons name="file-eye-outline" size={22} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: 'bold',
              letterSpacing: 1.1,
              textTransform: 'uppercase',
            }}>
              {loading ? 'Gerando...' : 'Visualizar PDF'}
            </Text>
            {loading && <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 10 }} />}
          </TouchableOpacity>
          {loading && <ActivityIndicator size="large" color="#d7263d" style={{ marginTop: 20 }} />}
        </View>
      </View>
    </View>
  );
};

export default PdfScreen;
