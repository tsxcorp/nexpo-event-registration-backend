const xlsx = require('xlsx');

const parseExcel = (buffer) => {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = xlsx.utils.sheet_to_json(sheet);
  return jsonData;
};

module.exports = { parseExcel };
