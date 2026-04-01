export const validadeTratativasTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: 10mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; margin: 0; padding: 0; }
      .container { width: 100%; max-width: 100%; margin: 0; background: #fff; padding: 10px; box-sizing: border-box; }
      .header-row { display: flex; align-items: center; justify-content: flex-start; border-bottom: 3px solid #294380; padding-bottom: 15px; margin-bottom: 20px; }
      .logo { width: 120px; height: 60px; object-fit: contain; margin-right: 20px; }
      .header-content { text-align: left; flex: 1; }
      .header-title { font-size: 22px; color: #294380; font-weight: bold; margin: 0; text-transform: uppercase; }
      .sub-title { font-size: 14px; color: #4666b2; margin-top: 5px; margin: 0; }
      .info-table { width: 100%; margin-top: 20px; font-size: 11px; border-collapse: collapse; }
      .info-table td { padding: 4px 8px; border: none; }
      .info-table .label { color: #294380; font-weight: bold; width: 110px; text-align: right; padding-right: 10px; }
      .products-table { width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 10px; table-layout: fixed; }
      .products-table th, .products-table td { border: 1px solid #e0e0e0; padding: 6px 4px; text-align: center; word-wrap: break-word; overflow-wrap: break-word; }
      .products-table th { background: #294380; color: #fff; font-weight: bold; text-transform: uppercase; }
      .products-table tr:nth-child(even) { background: #f9f9f9; }
      .footer { margin-top: 30px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header-row">
        {{LOGO_HTML}}
        <div class="header-content">
          <div class="header-title">Relatorio de Tratativas</div>
          <div class="sub-title">Gestao de Saidas e Ocorrencias</div>
        </div>
      </div>
      <table class="info-table">
        <tr><td class="label">Data Emissao:</td><td>{{DATA_EMISSAO}}</td><td class="label">Total Itens:</td><td>{{TOTAL_ITENS}}</td></tr>
        <tr><td class="label">Usuario:</td><td>{{USER_NAME}}</td><td class="label">Filtro:</td><td>{{FILTRO_APLICADO}}</td></tr>
      </table>
      <table class="products-table">
        <thead>
          <tr>
            <th width="5%">#</th>
            <th width="35%">Produto</th>
            <th width="10%">Cod.</th>
            <th width="12%">Lote</th>
            <th width="8%">Qtd</th>
            <th width="15%">Tipo</th>
            <th width="15%">Data</th>
          </tr>
        </thead>
        <tbody>
          {{PRODUTOS_HTML}}
        </tbody>
      </table>
      <div class="footer">Gerado automaticamente pelo aplicativo Gestao de Validades - {{ANO_EMISSAO}}</div>
    </div>
  </body>
</html>`;

export default validadeTratativasTemplate;
