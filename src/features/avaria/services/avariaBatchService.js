import {
  readAvariaBatches,
  writeAvariaBatches,
} from '../storage/avariaBatchStorage';

export const listAvariaBatches = async () => {
  return readAvariaBatches();
};

export const loadAvariaBatchById = async (batchId) => {
  const batches = await readAvariaBatches();
  return batches.find((item) => item?.id === batchId) || null;
};

export const listOpenAvariaBatches = async () => {
  const batches = await readAvariaBatches();
  return batches
    .filter((item) => item?.status === 'open')
    .sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0));
};

export const listConcludedAvariaBatches = async () => {
  const batches = await readAvariaBatches();
  return batches
    .filter((item) => item?.status === 'concluded')
    .sort((a, b) => new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0));
};

export const saveAvariaBatch = async (batchData) => {
  const batches = await readAvariaBatches();
  const nextBatches = batches.some((item) => item?.id === batchData.id)
    ? batches.map((item) => (item?.id === batchData.id ? batchData : item))
    : [...batches, batchData];

  await writeAvariaBatches(nextBatches);
  return batchData;
};

export const deleteAvariaBatch = async (batchId) => {
  const batches = await readAvariaBatches();
  const filtered = batches.filter((item) => item?.id !== batchId);
  await writeAvariaBatches(filtered);
  return filtered;
};

export const clearConcludedAvariaBatches = async () => {
  const batches = await readAvariaBatches();
  const filtered = batches.filter((item) => item?.status !== 'concluded');
  await writeAvariaBatches(filtered);
  return filtered;
};
