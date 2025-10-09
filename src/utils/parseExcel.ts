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
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    
    // Try to load with ExcelJS
    try {
      await workbook.xlsx.load(arrayBuffer);
    } catch (excelJsError) {
      // If ExcelJS fails (e.g., due to unsupported filters), throw a more helpful error
      console.error('ExcelJS parsing error:', excelJsError);
      throw new Error(`Excel file contains unsupported features. Please try: 1) Removing any date filters or advanced formatting, 2) Saving as a new .xlsx file, or 3) Converting to CSV and uploading as text.`);
    }

    const sheets: SheetData[] = [];

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      const jsonData: Record<string, any>[] = [];
      let headers: string[] = [];
      const allRows: Array<{ rowNumber: number; values: any[] }> = [];

      // First pass: collect all rows and find max column count
      let maxColumns = 0;
      worksheet.eachRow((row, rowNumber) => {
        const values = (row.values as any[]).slice(1); // Remove first empty element
        maxColumns = Math.max(maxColumns, values.length);
        allRows.push({ rowNumber, values });
      });

      // Extract headers from first row or generate them
      if (allRows.length > 0 && allRows[0].rowNumber === 1) {
        const firstRowValues = allRows[0].values;
        headers = Array.from({ length: maxColumns }, (_, i) => {
          const value = firstRowValues[i];
          // Handle formula cells in headers
          if (value && typeof value === 'object' && 'result' in value) {
            return String(value.result || `Column ${i + 1}`);
          }
          return value ? String(value) : `Column ${i + 1}`;
        });
      } else {
        // No header row, generate generic headers
        headers = Array.from({ length: maxColumns }, (_, i) => `Column ${i + 1}`);
      }

      // Second pass: build JSON data
      allRows.forEach(({ rowNumber, values }) => {
        if (rowNumber === 1) return; // Skip header row
        
        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          const cellValue = values[index];
          
          // Handle Excel formula cells - extract the result value
          if (cellValue && typeof cellValue === 'object' && 'result' in cellValue) {
            rowData[header] = cellValue.result !== undefined ? cellValue.result : null;
          } else {
            rowData[header] = cellValue !== undefined ? cellValue : null;
          }
        });
        
        jsonData.push(rowData);
      });

      if (jsonData.length > 0) {
        sheets.push({
          sheetName,
          headers,
          jsonData
        });
      }
    });

    if (sheets.length === 0) {
      throw new Error('No data found in Excel file');
    }

    return {
      fileName: file.name,
      sheets
    };
  } catch (error) {
    // Re-throw with file name for better error messages
    if (error instanceof Error) {
      throw new Error(`${file.name}: ${error.message}`);
    }
    throw error;
  }
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
