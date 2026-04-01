import { Image } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { getSignedProductImageUrl } from '../../../services/supabaseStorageService';
import {
  deriveProgress,
  formatDatePt,
  formatDateTimePt,
  getActionMeta,
  getOccurrenceMeta,
  getStatusMeta,
  normalizeSelectionValues,
  TRATATIVA_THEME,
} from '../constants/tratativaOptions';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getLogoBase64 = async () => {
  try {
    const assetSource = Image.resolveAssetSource(require('../../../../assets/Image/LOGOCOMFRASE.png'));
    const assetUri = assetSource?.uri;
    if (!assetUri) return '';
    const path = assetUri.startsWith('file://') ? assetUri.replace('file://', '') : assetUri;
    const base64 = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    return '';
  }
};

const renderSelectionValue = (values, fallback = 'Nao informado') => {
  const normalized = normalizeSelectionValues(values);
  if (normalized.length === 0) {
    return `<span class="value">${escapeHtml(fallback)}</span>`;
  }

  if (normalized.length === 1) {
    return `<span class="value">${escapeHtml(normalized[0])}</span>`;
  }

  return `
    <ul class="value-list">
      ${normalized.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
};

const resolveSnapshotImageSrc = async (snapshot = {}) => {
  const rawUrl = String(snapshot.imageUrl || '');
  if (rawUrl.startsWith('http') || rawUrl.startsWith('file://') || rawUrl.startsWith('content://')) {
    return rawUrl;
  }

  const rawPath = String(snapshot.imagePath || '');
  if (!rawPath) {
    return '';
  }

  try {
    return await getSignedProductImageUrl(rawPath, 7 * 24 * 3600);
  } catch {
    return '';
  }
};

export const buildTratativaCaseHtml = async (caseItem) => {
  const logoSrc = await getLogoBase64();
  const statusMeta = getStatusMeta(caseItem.status);
  const actionMeta = getActionMeta(caseItem.resolution_type);
  const occurrenceMeta = getOccurrenceMeta(caseItem.occurrence_type);
  const progress = deriveProgress(caseItem);
  const snapshot = caseItem.product_snapshot || {};
  const reasons = normalizeSelectionValues(caseItem.reasons, caseItem.reason);
  const productImageSrc = await resolveSnapshotImageSrc(snapshot);
  const isShortage = caseItem.occurrence_type === 'falta';
  const quantityCards = isShortage
    ? `
        <div class="detail-card"><span class="label">Quantidade esperada</span><span class="value">${escapeHtml(caseItem.expected_quantity)}</span></div>
        <div class="detail-card"><span class="label">Quantidade recebida</span><span class="value">${escapeHtml(caseItem.received_quantity)}</span></div>
        <div class="detail-card"><span class="label">Quantidade faltante</span><span class="value">${escapeHtml(caseItem.affected_quantity)}</span></div>
      `
    : `
        <div class="detail-card"><span class="label">Quantidade recebida</span><span class="value">${escapeHtml(caseItem.received_quantity || snapshot.quantidade_original)}</span></div>
        <div class="detail-card"><span class="label">Quantidade com problema</span><span class="value">${escapeHtml(caseItem.affected_quantity)}</span></div>
      `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 12mm; }
          body {
            font-family: Arial, sans-serif;
            background: #ffffff;
            color: #1f2937;
            margin: 0;
          }
          .shell {
            border: 1px solid #e5ebf3;
            border-radius: 24px;
            overflow: hidden;
          }
          .header {
            padding: 28px;
            border-bottom: 1px solid #e5ebf3;
            background: linear-gradient(180deg, #fff8f8 0%, #ffffff 100%);
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .logo {
            width: 140px;
            height: auto;
          }
          .eyebrow {
            text-transform: uppercase;
            letter-spacing: 1.2px;
            font-size: 11px;
            color: ${TRATATIVA_THEME.primary};
            font-weight: 700;
          }
          h1 {
            margin: 10px 0 6px;
            font-size: 28px;
            color: #1d2736;
          }
          p {
            margin: 0;
            color: #475467;
            line-height: 1.5;
          }
          .meta-grid,
          .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 18px;
          }
          .meta-card,
          .detail-card {
            border: 1px solid #e5ebf3;
            border-radius: 16px;
            padding: 14px;
            background: #ffffff;
          }
          .label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #667085;
            margin-bottom: 4px;
            font-weight: 700;
          }
          .value {
            font-size: 14px;
            font-weight: 700;
            color: #1d2736;
          }
          .pill {
            display: inline-block;
            padding: 8px 12px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: ${statusMeta.color};
            background: ${statusMeta.background};
          }
          .body {
            padding: 24px;
          }
          .section {
            border: 1px solid #e5ebf3;
            border-radius: 20px;
            padding: 18px;
            margin-bottom: 16px;
          }
          .section h2 {
            margin: 0 0 10px;
            font-size: 18px;
            color: #1d2736;
          }
          .timeline-bar {
            height: 10px;
            border-radius: 999px;
            background: #eef2f7;
            overflow: hidden;
            margin-top: 12px;
          }
          .timeline-fill {
            height: 100%;
            width: ${progress}%;
            background: ${TRATATIVA_THEME.primary};
          }
          .timeline-steps {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-top: 18px;
          }
          .timeline-step {
            border: 1px solid #e5ebf3;
            border-radius: 14px;
            padding: 12px;
            background: #fafbfe;
          }
          .timeline-step strong {
            display: block;
            font-size: 12px;
            margin-bottom: 6px;
          }
          .product-hero {
            display: flex;
            gap: 18px;
            align-items: flex-start;
            margin-bottom: 18px;
          }
          .product-photo {
            width: 140px;
            height: 140px;
            border-radius: 18px;
            object-fit: cover;
            border: 1px solid #e5ebf3;
            background: #f8fafc;
          }
          .product-photo-placeholder {
            width: 140px;
            height: 140px;
            border-radius: 18px;
            border: 1px dashed #cbd5e1;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #98a2b3;
            font-size: 12px;
            text-align: center;
            padding: 12px;
            box-sizing: border-box;
          }
          .observation {
            min-height: 110px;
            white-space: pre-wrap;
          }
          .value-list {
            margin: 0;
            padding-left: 18px;
            color: #1d2736;
            font-size: 14px;
            font-weight: 700;
          }
          .value-list li + li {
            margin-top: 4px;
          }
          .footer {
            margin-top: 18px;
            font-size: 10px;
            color: #667085;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="header">
            <div class="brand">
              ${logoSrc ? `<img class="logo" src="${logoSrc}" />` : ''}
              <div>
                <div class="eyebrow">Documento operacional</div>
                <h1>Espelho de Recebimento</h1>
                <p>Registro operacional de ocorrencia, evolucao e fechamento do recebimento no Gestao Hub.</p>
              </div>
            </div>
            <div class="meta-grid">
              <div class="meta-card">
                <span class="label">Documento</span>
                <span class="value">${escapeHtml(caseItem.doc_number || 'Sera gerado no primeiro salvamento')}</span>
              </div>
              <div class="meta-card">
                <span class="label">Status</span>
                <span class="pill">${escapeHtml(statusMeta.label)}</span>
              </div>
              <div class="meta-card">
                <span class="label">Criado em</span>
                <span class="value">${escapeHtml(formatDateTimePt(caseItem.created_at))}</span>
              </div>
              <div class="meta-card">
                <span class="label">NF de origem</span>
                <span class="value">${escapeHtml(caseItem.origin_invoice_number || 'Nao informada')}</span>
              </div>
              <div class="meta-card">
                <span class="label">Codigo do fornecedor</span>
                <span class="value">${escapeHtml(caseItem.supplier_code || 'Nao informado')}</span>
              </div>
            </div>
          </div>

          <div class="body">
            <div class="section">
              <h2>Mercadoria e fornecedor</h2>
              <div class="product-hero">
                ${productImageSrc
                  ? `<img class="product-photo" src="${productImageSrc}" />`
                  : '<div class="product-photo-placeholder">Sem foto vinculada</div>'}
                <div style="flex:1;">
                  <div class="details-grid" style="margin-top:0;">
                    <div class="detail-card"><span class="label">Descricao</span><span class="value">${escapeHtml(snapshot.descricao)}</span></div>
                    <div class="detail-card"><span class="label">Fornecedor</span><span class="value">${escapeHtml(snapshot.fornecedor)}</span></div>
                    <div class="detail-card"><span class="label">Codigo interno</span><span class="value">${escapeHtml(snapshot.codprod)}</span></div>
                    <div class="detail-card"><span class="label">EAN</span><span class="value">${escapeHtml(snapshot.codauxiliar)}</span></div>
                  </div>
                </div>
              </div>
              <div class="details-grid">
                <div class="detail-card"><span class="label">Quantidade recebida</span><span class="value">${escapeHtml(snapshot.quantidade_original)}</span></div>
                <div class="detail-card"><span class="label">Lote / validade</span><span class="value">${escapeHtml(snapshot.lote)} | ${escapeHtml(formatDatePt(snapshot.validade))}</span></div>
              </div>
            </div>

            <div class="section">
              <h2>Desfecho da ocorrencia</h2>
              <div class="details-grid">
                <div class="detail-card"><span class="label">Tipo de ocorrencia</span><span class="value" style="color:${occurrenceMeta.color};">${escapeHtml(occurrenceMeta.label)}</span></div>
                <div class="detail-card"><span class="label">Desfecho</span><span class="value" style="color:${actionMeta.color};">${escapeHtml(actionMeta.label)}</span></div>
                ${quantityCards}
                <div class="detail-card"><span class="label">Motivos</span>${renderSelectionValue(reasons)}</div>
                <div class="detail-card"><span class="label">NF de devolucao</span><span class="value">${escapeHtml(caseItem.return_invoice_number || 'Nao informada')}</span></div>
              </div>
            </div>

            <div class="section">
              <h2>Cronograma</h2>
              <div class="timeline-bar"><div class="timeline-fill"></div></div>
              <div class="details-grid" style="margin-top:12px;">
                <div class="detail-card"><span class="label">Progresso</span><span class="value">${progress}%</span></div>
                <div class="detail-card"><span class="label">Ultima atualizacao</span><span class="value">${escapeHtml(formatDateTimePt(caseItem.status_updated_at))}</span></div>
              </div>
              <div class="timeline-steps">
                <div class="timeline-step"><strong>Abertura</strong>${escapeHtml(formatDatePt(caseItem.opened_at))}</div>
                <div class="timeline-step"><strong>Início</strong>${escapeHtml(formatDatePt(caseItem.started_at))}</div>
                <div class="timeline-step"><strong>Previsão</strong>${escapeHtml(formatDatePt(caseItem.expected_end_at))}</div>
                <div class="timeline-step"><strong>Encerramento</strong>${escapeHtml(formatDatePt(caseItem.closed_at))}</div>
              </div>
            </div>

            <div class="section">
              <h2>Observacao</h2>
              <div class="observation">${escapeHtml(caseItem.observation || 'Sem observacoes adicionais.')}</div>
            </div>

            <div class="section">
              <h2>Responsaveis</h2>
              <div class="details-grid">
                <div class="detail-card"><span class="label">Autorizado por</span><span class="value">${escapeHtml(caseItem.authorized_by)}</span></div>
                <div class="detail-card"><span class="label">Recolhido por</span><span class="value">${escapeHtml(caseItem.collected_by)}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="footer">Gerado automaticamente pelo Gestão Hub</div>
      </body>
    </html>
  `;
};

export const shareTratativaCasePdf = async (caseItem) => {
  const html = await buildTratativaCaseHtml(caseItem);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const { filePath } = await RNHTMLtoPDF.convert({
    html,
    fileName: `espelho_recebimento_${caseItem.doc_number || stamp}`,
    directory: 'Documents',
  });

  const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  await Share.open({
    url: fileUrl,
    type: 'application/pdf',
    title: 'Compartilhar espelho de recebimento',
    failOnCancel: false,
  });

  return filePath;
};
