import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, deleteDoc, query, where, orderBy, limit, setDoc } from '@react-native-firebase/firestore';
import firebaseAuthService from './firebaseAuthService';

class FirebaseProductService {
  constructor() {
    this.db = getFirestore();
    this.productsCollection = 'products';
  }

  // Função auxiliar para gerar ID baseado na descrição
  generateProductId(descricao) {
    return descricao
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  async saveProduct(productData) {
    try {
      // Usa a descrição como ID
      const productId = this.generateProductId(productData.descricao);

      const productWithTimestamps = {
        ...productData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(this.db, this.productsCollection, productId), productWithTimestamps);
      
      return {
        success: true,
        id: productId,
        message: 'Produto salvo com sucesso!'
      };
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      throw new Error('Erro ao salvar produto no Firebase');
    }
  }

  async updateProduct(productId, productData) {
    try {
      // Se a descrição mudou, cria um novo ID baseado na nova descrição
      const newProductId = this.generateProductId(productData.descricao);

      const productWithTimestamps = {
        ...productData,
        updatedAt: new Date().toISOString()
      };

      if (newProductId !== productId) {
        await deleteDoc(doc(this.db, this.productsCollection, productId));
        await setDoc(doc(this.db, this.productsCollection, newProductId), productWithTimestamps);
      } else {
        const productRef = doc(this.db, this.productsCollection, productId);
        await updateDoc(productRef, productWithTimestamps);
      }
      
      return {
        success: true,
        id: newProductId,
        message: 'Produto atualizado com sucesso!'
      };
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      throw new Error('Erro ao atualizar produto no Firebase');
    }
  }

  async getProducts() {
    try {
      // Busca todos os produtos sem filtro de usuário
      const q = query(collection(this.db, this.productsCollection));
      const querySnapshot = await getDocs(q);
      const products = [];

      querySnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });

      products.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      return products;
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      throw new Error('Erro ao buscar produtos do Firebase');
    }
  }

  async getRecentProducts(limitCount = 5) {
    try {
      // Busca todos os produtos sem filtro de usuário
      const q = query(collection(this.db, this.productsCollection));
      const querySnapshot = await getDocs(q);
      const products = [];

      querySnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });

      products.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      return products.slice(0, limitCount);
    } catch (error) {
      console.error('Erro ao buscar produtos recentes:', error);
      throw new Error('Erro ao buscar produtos recentes do Firebase');
    }
  }

  async deleteProduct(productId) {
    try {
      await deleteDoc(doc(this.db, this.productsCollection, productId));
      
      return {
        success: true,
        message: 'Produto excluído com sucesso!'
      };
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      throw new Error('Erro ao excluir produto do Firebase');
    }
  }

  async searchProductByEAN(ean) {
    try {
      const q = query(
        collection(this.db, 'cached_products'),
        where('CODAUXILIAR', '==', ean)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        };
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar produto por EAN:', error);
      throw new Error('Erro ao buscar produto por EAN no Firebase');
    }
  }

  async syncProductsFromAsyncStorage() {
    try {
      // Buscar produtos do AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const existingProducts = await AsyncStorage.getItem('products');
      
      if (existingProducts) {
        const products = JSON.parse(existingProducts);
        
        for (const product of products) {
          if (!product.firebaseId) {
            await this.saveProduct(product);
          }
        }

        return {
          success: true,
          message: `${products.length} produtos migrados para o Firebase`
        };
      }

      return {
        success: true,
        message: 'Nenhum produto para migrar'
      };
    } catch (error) {
      console.error('Erro ao sincronizar produtos:', error);
      throw new Error('Erro ao sincronizar produtos com Firebase');
    }
  }

  async listenProducts(onUpdate) {
    const collectionRef = collection(this.db, this.productsCollection);
    return collectionRef.onSnapshot((querySnapshot) => {
      const products = [];
      querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() });
      });
      products.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      onUpdate(products);
    });
  }
}

export default new FirebaseProductService(); 