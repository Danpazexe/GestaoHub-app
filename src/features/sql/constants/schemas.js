import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import React from 'react';

/**
 * Definição das Tabelas do Banco de Dados (Mapping e Labels)
 */

export const DATABASE_TABLES = {
    PRODUCTS: {
        id: 'products',
        label: 'Produtos',
        icon: 'inventory',
        primaryKey: 'CODPROD',
        fields: [
            { key: 'CODPROD', label: 'Código', icon: 'tag' },
            { key: 'DESCRICAO', label: 'Descrição', icon: 'description' },
            { key: 'MARCA', label: 'Marca', icon: 'local-offer' },
            { key: 'DEPARTAMENTO', label: 'Departamento', icon: 'category' },
            { key: 'SECAO', label: 'Seção', icon: 'folder-special' },
            { key: 'CODAUXILIAR', label: 'EAN', icon: 'qr-code' },
            { key: 'CODAUXILIAR2', label: 'DUN', icon: 'qr-code-2' },
        ],
        normalize: (item) => ({
            CODPROD: item.CODPROD || item.id || 0,
            DESCRICAO: item.DESCRICAO || item.descricao || item.nome || '',
            MARCA: item.MARCA || item.marca || 'N/A',
            DEPARTAMENTO: item.DEPARTAMENTO || item.departamento || 'Geral',
            SECAO: item.SECAO || item.secao || 'Geral',
            CODAUXILIAR: item.CODAUXILIAR || item.codauxiliar || item.ean || '',
            CODAUXILIAR2: item.CODAUXILIAR2 || item.codauxiliar2 || item.dun || ''
        })
    },
    // Definição da "Tabela" de Avarias
    AVARIA: {
        id: 'avaria_batches',
        label: 'Avarias',
        icon: 'layers',
        primaryKey: 'id',
        fields: [
            { key: 'id', label: 'ID Lote', icon: 'tag' },
            { key: 'supplierName', label: 'Fornecedor', icon: 'business' },
            { key: 'bonusType', label: 'Tipo Bônus', icon: 'stars' },
            { key: 'status', label: 'Status', icon: 'flag' },
            { key: 'updatedAt', label: 'Última Atualização', icon: 'event' },
        ],
        normalize: (item) => ({
            id: item.id || Date.now().toString(),
            supplierName: item.supplierName || 'N/I',
            bonusType: item.bonusType || 'merchandise',
            status: item.status || 'open',
            updatedAt: item.updatedAt || new Date().toISOString(),
            items: item.items || [],
        })
    }
};
