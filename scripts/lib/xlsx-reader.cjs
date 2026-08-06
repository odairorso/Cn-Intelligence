// Leitor XLSX seguro baseado em read-excel-file/node (sem depender do pacote xlsx).
// Mantém uma API mínima compatível com os scripts legados: readWorkbook + sheetToJson.

async function loadReadExcelFile() {
  const mod = await import('read-excel-file/node');
  return mod.default || mod;
}

/**
 * Lê um arquivo XLSX (path, Buffer, Stream ou Blob) e retorna uma estrutura
 * parecida com a do pacote xlsx: { SheetNames, Sheets }.
 */
async function readWorkbook(input) {
  const readExcelFile = await loadReadExcelFile();
  const sheets = await readExcelFile(input);
  const SheetNames = sheets.map((entry) => entry.sheet);
  const Sheets = {};
  for (const entry of sheets) {
    Sheets[entry.sheet] = { data: entry.data };
  }
  return { SheetNames, Sheets };
}

/**
 * Converte uma worksheet ({ data }) em matriz de linhas (header: 1) ou em objetos.
 */
function sheetToJson(worksheet, options = {}) {
  const rows = worksheet && Array.isArray(worksheet.data) ? worksheet.data : [];
  if (options.header === 1) return rows;
  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h ?? '').trim());
  return rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.some((cell) => cell !== undefined && cell !== null && cell !== ''))
    .map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (header) obj[header] = row[index];
      });
      return obj;
    });
}

module.exports = { readWorkbook, sheetToJson };
