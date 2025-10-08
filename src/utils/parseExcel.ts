import * as ExcelJS from 'exceljs';

export interface SheetData {
  sheetName: string;
  headers: string[];
  jsonData: Record<string, any>[];
}

export interface ExcelData {
  fileName: string;
  sheets: SheetData[];
}

export const parseExcelFile = async (file: File): Promise<ExcelData> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheets: SheetData[] = [];

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name;
    const jsonData: Record<string, any>[] = [];
    let headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // First row is headers
        headers = row.values as string[];
        headers = headers.slice(1); // Remove first empty element from ExcelJS
      } else {
        // Data rows
        const rowData: Record<string, any> = {};
        const values = row.values as any[];
        
        headers.forEach((header, index) => {
          // index + 1 because ExcelJS array starts with empty element
          rowData[header] = values[index + 1] !== undefined ? values[index + 1] : null;
        });
        
        jsonData.push(rowData);
      }
    });

    if (jsonData.length > 0) {
      sheets.push({
        sheetName,
        headers,
        jsonData
      });
    }
  });

  return {
    fileName: file.name,
    sheets
  };
};

export const formatExcelDataForChat = (
  fileName: string,
  selectedData: Array<{
    sheetName: string;
    headers: string[];
    selectedRows: Record<string, any>[];
  }>
): string => {
  let output = `\n\n=== ${fileName} ===\n\n`;

  selectedData.forEach((sheet) => {
    output += `\n## Sheet: ${sheet.sheetName}\n\n`;
    output += `**Headers:** ${sheet.headers.join(', ')}\n\n`;
    output += `**Data (${sheet.selectedRows.length} rows):**\n\n`;
    output += '```json\n';
    output += JSON.stringify(sheet.selectedRows, null, 2);
    output += '\n```\n';
  });

  return output;
};
