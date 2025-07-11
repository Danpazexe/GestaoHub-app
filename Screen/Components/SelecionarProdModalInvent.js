import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

const filtrosPadrao = [
  { label: "Nome", value: "DESCRICAO" },
  { label: "Código", value: "CODPROD" },
  { label: "Marca", value: "MARCA" },
  { label: "Departamento", value: "DEPARTAMENTO" },
];

const SelecionarProdModalInvent = ({
  visible,
  onClose,
  produtosDisponiveis = [],
  onAddProdutos,
  isDarkMode,
}) => {
  const [filtro, setFiltro] = useState("DESCRICAO");
  const [busca, setBusca] = useState("");
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const flatListRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(true);

  // Filtragem
  const produtosFiltrados = produtosDisponiveis.filter((p) => {
    const valor = (p[filtro] || "").toString().toLowerCase();
    return valor.includes(busca.toLowerCase());
  });

  // Seleção
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

  // Scroll
  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const temItens = produtosFiltrados.length > 0;
    setShowScrollTop(offsetY > 100 && temItens);
    setShowScrollBottom(offsetY + layoutHeight < contentHeight - 100 && temItens);
  };

  // Adicionar produtos selecionados
  const handleAdd = () => {
    const selecionados = produtosDisponiveis.filter((p) =>
      produtosSelecionados.includes(p.CODPROD)
    );
    onAddProdutos(selecionados);
    setProdutosSelecionados([]);
    setBusca("");
    setFiltro("DESCRICAO");
    onClose();

  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? "#181A20" : "#fff" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={28} color="#7c3aed" />
            </TouchableOpacity>

            <Text style={{ fontSize: 18, fontWeight: "bold", marginLeft: 16, color: "#7c3aed" }}>Selecionar Produtos</Text>
          </View>
          {produtosFiltrados.length > 0 && (
            <TouchableOpacity onPress={toggleSelecionarTodos} style={{ flexDirection: "row", alignItems: "center", backgroundColor: todosSelecionados ? "#ede9fe" : "#7c3aed", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 }}>
              <MaterialIcons name={todosSelecionados ? "check-box" : "check-box-outline-blank"} size={20} color={todosSelecionados ? "#7c3aed" : "#fff"} />
              <Text style={{ color: todosSelecionados ? "#7c3aed" : "#fff", marginLeft: 4, fontWeight: "bold" }}>{todosSelecionados ? "Desmarcar Todos" : "Selecionar Todos"}</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Busca */}
        <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={{ backgroundColor: isDarkMode ? "#23262F" : "#f3f4f6", color: isDarkMode ? "#fff" : "#222", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}
              placeholder={`Buscar por ${filtrosPadrao.find(f => f.value === filtro).label.toLowerCase()}...`}
              placeholderTextColor="#aaa"
              value={busca}
              onChangeText={setBusca}
            />
          </View>
        </View>
        {/* Filtros */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 8, marginBottom: 8 }}>
          {filtrosPadrao.map(f => (
            <TouchableOpacity
              key={f.value}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 16,
                backgroundColor: filtro === f.value ? '#7c3aed' : '#ede9fe',
                marginHorizontal: 2,
                marginBottom: 6,
                minWidth: 70,
                alignItems: 'center',
              }}
              onPress={() => setFiltro(f.value)}
            >
              <Text style={{ color: filtro === f.value ? '#fff' : '#7c3aed', fontSize: 14, fontWeight: 'bold' }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Lista de produtos */}
        <FlatList
          ref={flatListRef}
          data={produtosFiltrados}
          keyExtractor={item => item.CODPROD?.toString()}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            const id = item.CODPROD;
            const selecionado = produtosSelecionados.includes(id);
            return (
              <TouchableOpacity style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingHorizontal: 20 }, selecionado && { backgroundColor: '#ede9fe' }]} onPress={() => toggleSelecionado(id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name={selecionado ? 'check-box' : 'check-box-outline-blank'} size={22} color={selecionado ? '#7c3aed' : '#bbb'} />
                  <View>
                    <Text style={{ color: isDarkMode ? '#fff' : '#222', fontWeight: 'bold' }}>{item.DESCRICAO}</Text>
                    <Text style={{ color: '#7c3aed', fontSize: 12 }}>Cód: {item.CODPROD} | Marca: {item.MARCA} | Dep: {item.DEPARTAMENTO}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={{ color: '#aaa', fontSize: 13, textAlign: 'center', marginTop: 32 }}>Nenhum produto cadastrado.</Text>}
          style={{ marginBottom: 12 }}
        />
        {/* Botões flutuantes de scroll */}
        {produtosFiltrados.length > 0 && showScrollTop && (
          <TouchableOpacity
            style={{ position: 'absolute', right: 20, bottom: 150, backgroundColor: '#7c3aed', borderRadius: 25, padding: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <MaterialIcons name="keyboard-arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        {produtosFiltrados.length > 0 && showScrollBottom && (
          <TouchableOpacity
            style={{ position: 'absolute', right: 20, bottom: 100, backgroundColor: '#7c3aed', borderRadius: 25, padding: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }}
            onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
          >
            <MaterialIcons name="keyboard-arrow-down" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        {/* Botão de adicionar ao inventário */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', padding: 16 }}>
          <TouchableOpacity
            style={{ backgroundColor: '#7c3aed', borderRadius: 8, paddingVertical: 16, alignItems: 'center', width: '100%', maxWidth: 500 }}
            onPress={handleAdd}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
              Adicionar ao Inventário
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default SelecionarProdModalInvent; 