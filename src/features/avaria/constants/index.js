export const DAMAGE_TYPES = {
    broken: { label: 'Quebrado', icon: 'glass-fragile', color: '#ef5350' },
    leaking: { label: 'Vazando', icon: 'water', color: '#29b6f6' },
    expired: { label: 'Vencido', icon: 'calendar-remove', color: '#ffa726' },
    spoiled: { label: 'Estragado', icon: 'food-off', color: '#8d6e63' },
    missing: { label: 'Faltando Peça', icon: 'puzzle', color: '#ab47bc' },
    other: { label: 'Outro', icon: 'help-circle-outline', color: '#bdbdbd' },
};

export const BONUS_TYPES = {
    merchandise: { label: 'Bonif. Mercadoria', icon: 'package-variant', color: '#66bb6a', desc: 'Reposição física do item' },
    money: { label: 'Verba Dinheiro', icon: 'cash-multiple', color: '#42a5f5', desc: 'Crédito financeiro/Desconto' },
    exchange: { label: 'Troca (Item a Item)', icon: 'swap-horizontal', color: '#ab47bc', desc: 'Troca imediata pelo mesmo item' },
};

export const RESOLUTION_TYPES = {
    discard: { label: 'Descarte', icon: 'delete-outline', color: '#8d6e63', desc: 'Item sem condições de uso. Irá para o lixo.' },
    supplier_return: { label: 'Devolução', icon: 'keyboard-return', color: '#42a5f5', desc: 'Devolver ao fornecedor para troca/crédito.' },
    donation: { label: 'Doação', icon: 'volunteer-activism', color: '#ec407a', desc: 'Ainda consumível, doar para instituição.' },
    discount_sale: { label: 'Venda c/ Desconto', icon: 'percent', color: '#66bb6a', desc: 'Vender com preço reduzido.' },
    stock_return: { label: 'Retornar ao Estoque', icon: 'undo', color: '#fdd835', desc: 'Engano, item está bom. Voltar para prateleira.' },
};
