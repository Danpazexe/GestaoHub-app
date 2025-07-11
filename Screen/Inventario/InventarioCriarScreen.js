import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SelecionarProdModalInvent from '../Components/SelecionarProdModalInvent';

const tiposInventario = [
  { label: "Rotativo", value: "rotativo" },
  { label: "Cíclico", value: "ciclico" },
  { label: "Geral", value: "geral" },
];

const filtros = [
  { label: "Nome", value: "DESCRICAO" },
  { label: "Código", value: "CODPROD" },
  { label: "Marca", value: "MARCA" },
  { label: "Departamento", value: "DEPARTAMENTO" },
];

const InventarioCriarScreen = ({ navigation, isDarkMode }) => {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState(tiposInventario[0].value);
  const [obs, setObs] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [modalProdutos, setModalProdutos] = useState(false);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [filtro, setFiltro] = useState("DESCRICAO");
  const [busca, setBusca] = useState("");

  // Estados para as setas de scroll
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(true);
  const flatListRef = useRef(null);
  const mainFlatListRef = useRef(null);
  const [showMainScrollTop, setShowMainScrollTop] = useState(false);
  const [showMainScrollBottom, setShowMainScrollBottom] = useState(true);

  // Data de início sempre a data atual
  const dataInicio = new Date();

  const handleAddProduto = () => {
    const novos = produtosDisponiveis.filter((p) =>
      produtosSelecionados.includes(p.CODPROD)
    );
    const jaAdicionados = produtos.map((p) => p.CODPROD);
    const paraAdicionar = novos.filter(
      (p) => !jaAdicionados.includes(p.CODPROD)
    );
    setProdutos([...produtos, ...paraAdicionar]);
    setProdutosSelecionados([]);
    setModalProdutos(false);
  };

  const handleRemoveProduto = (codprod) => {
    setProdutos(produtos.filter((p) => p.CODPROD !== codprod));
  };

  const handleLancar = () => {
    if (!nome.trim() || !tipo || produtos.length === 0) {
      alert(
        "Preencha todos os campos obrigatórios e adicione pelo menos um produto!"
      );
      return;
    }
    alert("Inventário lançado com sucesso!");
    navigation.goBack();
  };

  const abrirModalProdutos = async () => {
    try {
      const stored = await AsyncStorage.getItem("cached_products");
      if (stored) {
        const lista = JSON.parse(stored);
        setProdutosDisponiveis(lista);
      } else {
        setProdutosDisponiveis([]);
      }
    } catch {
      setProdutosDisponiveis([]);
    }
    setModalProdutos(true);
  };

  const produtosFiltrados = produtosDisponiveis.filter((p) => {
    const valor = (p[filtro] || "").toString().toLowerCase();
    return valor.includes(busca.toLowerCase());
  });

  const toggleSelecionado = (codprod) => {
    setProdutosSelecionados((prev) =>
      prev.includes(codprod)
        ? prev.filter((x) => x !== codprod)
        : [...prev, codprod]
    );
  };

  const toggleSelecionarTodos = () => {
    const idsFiltrados = produtosFiltrados.map((p) => p.CODPROD);
    const todosSelecionados = idsFiltrados.every((id) =>
      produtosSelecionados.includes(id)
    );
    if (todosSelecionados) {
      setProdutosSelecionados((prev) =>
        prev.filter((id) => !idsFiltrados.includes(id))
      );
    } else {
      setProdutosSelecionados((prev) =>
        Array.from(new Set([...prev, ...idsFiltrados]))
      );
    }
  };

  const todosSelecionados =
    produtosFiltrados.length > 0 &&
    produtosFiltrados.every((p) => produtosSelecionados.includes(p.CODPROD));

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;

    // Só mostra as setas se a lista tiver itens
    const temItens = produtosFiltrados.length > 0;

    setShowScrollTop(offsetY > 100 && temItens);
    setShowScrollBottom(
      offsetY + layoutHeight < contentHeight - 100 && temItens
    );
  };

  const handleMainScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;

    // Só mostra as setas se a lista tiver itens
    const temItens = produtos.length > 0;

    setShowMainScrollTop(offsetY > 100 && temItens);
    setShowMainScrollBottom(
      offsetY + layoutHeight < contentHeight - 100 && temItens
    );
  };

  // Cabeçalho do FlatList com os campos de formulário
  const renderHeader = () => (
    <View style={{ padding: 20, paddingBottom: 0 }}>
      <Text style={styles.label}>Nome do Inventário *</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: isDarkMode ? "#fff" : "#222",
            backgroundColor: isDarkMode ? "#23262F" : "#fff",
          },
        ]}
        value={nome}
        onChangeText={setNome}
        placeholder="Ex: Inventário Julho 2025"
        placeholderTextColor="#aaa"
      />
      <Text style={styles.label}>Tipo *</Text>
      <View style={styles.rowChips}>
        {tiposInventario.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.chip, tipo === t.value && styles.chipSelected]}
            onPress={() => setTipo(t.value)}
          >
            <Text style={{ color: tipo === t.value ? "#fff" : "#7c3aed" }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Data de Início</Text>
      <View
        style={[
          styles.dataCard,
          { backgroundColor: isDarkMode ? "#7c3aed" : "#ede9fe" },
        ]}
      >
        <MaterialIcons
          name="event"
          size={22}
          color={isDarkMode ? "#fff" : "#7c3aed"}
          style={{ marginRight: 8 }}
        />
        <Text
          style={{
            color: isDarkMode ? "#fff" : "#7c3aed",
            fontWeight: "bold",
            fontSize: 16,
          }}
        >
          {dataInicio.toLocaleDateString("pt-BR")}
        </Text>
      </View>
      <Text style={styles.label}>Observações</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: isDarkMode ? "#fff" : "#222",
            backgroundColor: isDarkMode ? "#23262F" : "#fff",
            minHeight: 60,
          },
        ]}
        value={obs}
        onChangeText={setObs}
        placeholder="Observações (opcional)"
        placeholderTextColor="#aaa"
        multiline
      />
      <View style={styles.produtosHeader}>
        <Text style={styles.label}>
          Produtos Selecionados: {produtos.length}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirModalProdutos}>
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={{ color: "#fff", marginLeft: 4 }}>
            Adicionar Produtos
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#181A20" : "#f8fafc" },
      ]}
    >
      <FlatList
        ref={mainFlatListRef}
        ListHeaderComponent={renderHeader}
        data={produtos}
        keyExtractor={(item) => item.CODPROD?.toString()}
        onScroll={handleMainScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.produtoItem}>
            <View>
              <Text
                style={{
                  color: isDarkMode ? "#fff" : "#222",
                  fontWeight: "bold",
                }}
              >
                {item.DESCRICAO}
              </Text>
              <Text style={{ color: "#7c3aed", fontSize: 12 }}>
                Cód: {item.CODPROD} | Marca: {item.MARCA} | Dep:{" "}
                {item.DEPARTAMENTO}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemoveProduto(item.CODPROD)}>
              <MaterialIcons name="delete" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text
            style={{
              color: "#aaa",
              fontSize: 13,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            Nenhum produto adicionado.
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListFooterComponent={
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#f3f4f6" }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={{ color: "#7c3aed", fontWeight: "bold" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]}
              onPress={handleLancar}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                Lançar Inventário
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Botões flutuantes de scroll para a lista principal */}
      {produtos.length > 0 && showMainScrollTop && (
        <TouchableOpacity
          style={[styles.scrollButton, { bottom: 80 }]}
          onPress={() =>
            mainFlatListRef.current?.scrollToOffset({
              offset: 0,
              animated: true,
            })
          }
        >
          <MaterialIcons name="keyboard-arrow-up" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {produtos.length > 0 && showMainScrollBottom && (
        <TouchableOpacity
          style={[styles.scrollButton, { bottom: 20 }]}
          onPress={() =>
            mainFlatListRef.current?.scrollToEnd({ animated: true })
          }
        >
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal de seleção de produtos totalmente autocontido */}
      <SelecionarProdModalInvent
        visible={modalProdutos}
        onClose={() => setModalProdutos(false)}
        produtosDisponiveis={produtosDisponiveis}
        isDarkMode={isDarkMode}
        onAddProdutos={selecionados => {
          // Adiciona apenas produtos que ainda não estão na lista
          setProdutos(prev => [
            ...prev,
            ...selecionados.filter(p => !prev.some(item => item.CODPROD === p.CODPROD))
          ]);
          setModalProdutos(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontWeight: "bold",
    color: "#7c3aed",
    marginBottom: 4,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    
  },
  rowChips: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#7c3aed",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  chipSelected: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  dataCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    marginTop: 4,
  },
  produtosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  produtoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingHorizontal: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 12,
    paddingHorizontal: 20,
  },
  actionBtn: { flex: 1, alignItems: "center", padding: 14, borderRadius: 8 },
  scrollButton: {
    position: "absolute",
    right: 20,
    backgroundColor: "#7c3aed",
    borderRadius: 25,
    padding: 12,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default InventarioCriarScreen;
