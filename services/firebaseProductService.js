import { getFirestore, collection, addDoc, updateDoc, doc, getDocs, deleteDoc, query, where, orderBy, limit, setDoc } from '@react-native-firebase/firestore';
import firebaseAuthService from './firebaseAuthService';

class FirebaseProductService {
  constructor() {
    this.db = getFirestore();
    this.productsCollection = 'products';
  }

  async getCurrentUserId() {
    const user = await firebaseAuthService.getCurrentUser();
    return user ? user.id : null;
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
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Usa a descrição como ID
      const productId = this.generateProductId(productData.descricao);

      const productWithUser = {
        ...productData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Usa setDoc para definir o ID personalizado
      await setDoc(doc(this.db, this.productsCollection, productId), productWithUser);
      
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
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Se a descrição mudou, cria um novo ID baseado na nova descrição
      const newProductId = this.generateProductId(productData.descricao);

      const productWithUser = {
        ...productData,
        userId,
        updatedAt: new Date().toISOString()
      };

      // Se o ID mudou, deleta o documento antigo e cria um novo
      if (newProductId !== productId) {
        await deleteDoc(doc(this.db, this.productsCollection, productId));
        await setDoc(doc(this.db, this.productsCollection, newProductId), productWithUser);
      } else {
        // Se o ID não mudou, apenas atualiza
        const productRef = doc(this.db, this.productsCollection, productId);
        await updateDoc(productRef, productWithUser);
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
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Consulta simplificada sem orderBy para evitar necessidade de índice
      const q = query(
        collection(this.db, this.productsCollection),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const products = [];

      querySnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Ordena localmente após buscar
      products.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // Ordem decrescente
      });

      return products;
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      throw new Error('Erro ao buscar produtos do Firebase');
    }
  }

  async getRecentProducts(limitCount = 5) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Consulta simplificada sem orderBy para evitar necessidade de índice
      const q = query(
        collection(this.db, this.productsCollection),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const products = [];

      querySnapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Ordena localmente e limita
      products.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA; // Ordem decrescente
      });

      return products.slice(0, limitCount);
    } catch (error) {
      console.error('Erro ao buscar produtos recentes:', error);
      throw new Error('Erro ao buscar produtos recentes do Firebase');
    }
  }

  async deleteProduct(productId) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

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
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

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
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar produtos do AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      const existingProducts = await AsyncStorage.getItem('products');
      
      if (existingProducts) {
        const products = JSON.parse(existingProducts);
        
        // Migrar produtos para o Firebase
        for (const product of products) {
          if (!product.firebaseId) { // Evitar duplicatas
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
}

export default new FirebaseProductService(); 