const pad2 = (n) => String(n).padStart(2, '0');

const toIso = (d) => new Date(d).toISOString();

export const buildBonusRecebimentoList = () => {
  const now = new Date();
  const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 20, 0, 0);

  return [
    {
      id: 'bon-1',
      supplierCode: '1222',
      supplierName: 'Fornecedor 1222',
      invoice: 'NF-10001',
      createdAt: toIso(baseDate),
      lines: 14,
      status: 'pendente',
    },
    {
      id: 'bon-2',
      supplierCode: '1003',
      supplierName: 'Distribuidora Aurora',
      invoice: 'NF-10002',
      createdAt: toIso(new Date(baseDate.getTime() - 1000 * 60 * 55)),
      lines: 10,
      status: 'pendente',
    },
    {
      id: 'bon-3',
      supplierCode: '9001',
      supplierName: 'Atacado Nordeste',
      invoice: 'NF-10003',
      createdAt: toIso(new Date(baseDate.getTime() - 1000 * 60 * 140)),
      lines: 18,
      status: 'pendente',
    },
    {
      id: 'bon-4',
      supplierCode: '777',
      supplierName: 'Fornecedor 777',
      invoice: 'NF-09999',
      createdAt: toIso(new Date(baseDate.getTime() - 1000 * 60 * 260)),
      lines: 12,
      status: 'pendente',
    },
    {
      id: 'bon-5',
      supplierCode: '2040',
      supplierName: 'Indústria Alfa',
      invoice: `NF-${now.getFullYear()}${pad2(now.getMonth() + 1)}15-01`,
      createdAt: toIso(new Date(baseDate.getTime() - 1000 * 60 * 390)),
      lines: 16,
      status: 'pendente',
    },
  ];
};

