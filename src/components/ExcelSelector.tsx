import React, { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { X, FileText } from 'lucide-react';
import { ExcelData, formatExcelDataForChat } from '@/utils/parseExcel';

interface SelectedSheetData {
  sheetName: string;
  headers: string[];
  selectedRows: Record<string, any>[];
}

interface ExcelSelectorProps {
  excelData: ExcelData;
  onClose: () => void;
  onSelect: (selectedData: {
    fileName: string;
    selectedData: SelectedSheetData[];
    formattedContent: string;
    totalRows: number;
  }) => void;
}

export function ExcelSelector({ excelData, onClose, onSelect }: ExcelSelectorProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Record<number, Set<number>>>({});

  const activeSheet = excelData.sheets[activeSheetIndex];

  const getSheetSelectionCount = (sheetIndex: number): number => {
    return selectedRows[sheetIndex]?.size || 0;
  };

  const isSheetFullySelected = (sheetIndex: number): boolean => {
    const sheet = excelData.sheets[sheetIndex];
    const selectionCount = getSheetSelectionCount(sheetIndex);
    return selectionCount > 0 && selectionCount === sheet.jsonData.length;
  };

  const isSheetPartiallySelected = (sheetIndex: number): boolean => {
    const selectionCount = getSheetSelectionCount(sheetIndex);
    return selectionCount > 0 && !isSheetFullySelected(sheetIndex);
  };

  const isRowSelected = (sheetIndex: number, rowIndex: number): boolean => {
    return selectedRows[sheetIndex]?.has(rowIndex) || false;
  };

  const toggleRowSelection = (sheetIndex: number, rowIndex: number) => {
    setSelectedRows(prev => {
      const newSelection = { ...prev };
      if (!newSelection[sheetIndex]) {
        newSelection[sheetIndex] = new Set();
      }
      
      if (newSelection[sheetIndex].has(rowIndex)) {
        newSelection[sheetIndex].delete(rowIndex);
      } else {
        newSelection[sheetIndex].add(rowIndex);
      }
      
      return newSelection;
    });
  };

  const toggleSheetSelection = (sheetIndex: number) => {
    const sheet = excelData.sheets[sheetIndex];
    const isFullySelected = isSheetFullySelected(sheetIndex);
    
    setSelectedRows(prev => {
      const newSelection = { ...prev };
      if (isFullySelected) {
        // Deselect all
        newSelection[sheetIndex] = new Set();
      } else {
        // Select all
        newSelection[sheetIndex] = new Set(
          Array.from({ length: sheet.jsonData.length }, (_, i) => i)
        );
      }
      return newSelection;
    });
  };

  const selectFullWorkbook = () => {
    const newSelection: Record<number, Set<number>> = {};
    excelData.sheets.forEach((sheet, sheetIndex) => {
      newSelection[sheetIndex] = new Set(
        Array.from({ length: sheet.jsonData.length }, (_, i) => i)
      );
    });
    setSelectedRows(newSelection);
  };

  const clearAllSelections = () => {
    setSelectedRows({});
  };

  const getTotalSelectionCount = (): number => {
    return Object.values(selectedRows).reduce((total, set) => total + set.size, 0);
  };

  const getSelectedSheetsCount = (): number => {
    return Object.values(selectedRows).filter(set => set.size > 0).length;
  };

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const confirmSelection = () => {
    const selectedData: SelectedSheetData[] = [];
    let totalRows = 0;

    Object.entries(selectedRows).forEach(([sheetIndexStr, rowIndices]) => {
      const sheetIndex = parseInt(sheetIndexStr);
      const sheet = excelData.sheets[sheetIndex];
      
      if (rowIndices.size > 0) {
        const selectedRowsData = Array.from(rowIndices)
          .map(rowIndex => sheet.jsonData[rowIndex])
          .filter(Boolean);
        
        selectedData.push({
          sheetName: sheet.sheetName,
          headers: sheet.headers,
          selectedRows: selectedRowsData
        });
        
        totalRows += selectedRowsData.length;
      }
    });

    const formattedContent = formatExcelDataForChat(excelData.fileName, selectedData);

    onSelect({
      fileName: excelData.fileName,
      selectedData,
      formattedContent,
      totalRows
    });
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold">Select Excel Data</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {excelData.fileName} • {excelData.sheets.length} sheet{excelData.sheets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Global actions */}
            <Button
              variant="ghost"
              onClick={selectFullWorkbook}
              className="text-green-600 hover:text-green-700"
            >
              Select Full Workbook
            </Button>
            <Button
              variant="ghost"
              onClick={clearAllSelections}
              className="text-destructive hover:text-destructive"
            >
              Clear All
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Sheet Tabs */}
          <div className="flex-shrink-0 border-b">
            <ScrollArea className="w-full">
              <div className="flex px-6">
                {excelData.sheets.map((sheet, index) => (
                  <button
                    key={sheet.sheetName}
                    onClick={() => setActiveSheetIndex(index)}
                    className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeSheetIndex === index
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{sheet.sheetName}</span>
                    {getSheetSelectionCount(index) > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {getSheetSelectionCount(index)}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Sheet Content */}
          {activeSheet && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Sheet Header */}
              <div className="flex-shrink-0 bg-muted/50 px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">{activeSheet.sheetName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {activeSheet.jsonData.length} rows • {activeSheet.headers.length} columns
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant={isSheetFullySelected(activeSheetIndex) ? "default" : "outline"}
                      onClick={() => toggleSheetSelection(activeSheetIndex)}
                    >
                      {isSheetFullySelected(activeSheetIndex) ? 'Deselect All' : 'Select All'}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      {getSheetSelectionCount(activeSheetIndex)} of {activeSheet.jsonData.length} selected
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Container with ScrollArea */}
              <div className="flex-1 min-h-0">
                {activeSheet.jsonData.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No data in this sheet</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full overflow-x-auto overflow-y-auto border border-border">
                    <div className="min-w-full inline-block align-top">
                      <table className="w-full border-collapse">{/* ... keep existing table ... */}
                      {/* Header */}
                      <thead className="sticky top-0 z-20 bg-muted">
                        <tr>
                          {/* Checkbox Column */}
                          <th className="sticky left-0 z-30 w-12 px-4 py-3 bg-muted border-r">
                            <Checkbox
                              checked={isSheetFullySelected(activeSheetIndex)}
                              onCheckedChange={() => toggleSheetSelection(activeSheetIndex)}
                              className={isSheetPartiallySelected(activeSheetIndex) ? "data-[state=checked]:bg-primary/50" : ""}
                            />
                          </th>
                          {/* Row Number Column */}
                          <th className="sticky left-12 z-30 w-20 px-4 py-3 bg-muted border-r text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Row
                          </th>
                          {/* Data Headers */}
                          {activeSheet.headers.map((header, headerIndex) => (
                            <th
                              key={`header-${headerIndex}`}
                              className="min-w-[160px] px-4 py-3 bg-muted text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-r"
                            >
                              <div className="truncate" title={header}>
                                {header}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      {/* Body */}
                      <tbody className="bg-background divide-y">
                        {activeSheet.jsonData.map((row, rowIndex) => (
                            <tr
                              key={`row-${rowIndex}`}
                              className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                                isRowSelected(activeSheetIndex, rowIndex) ? 'bg-primary/10' : ''
                              }`}
                              onClick={() => toggleRowSelection(activeSheetIndex, rowIndex)}
                            >
                              {/* Checkbox Cell */}
                              <td className={`sticky left-0 z-10 w-12 px-4 py-3 border-r ${
                                isRowSelected(activeSheetIndex, rowIndex) ? 'bg-primary/10' : 'bg-background'
                              }`}>
                                <Checkbox
                                  checked={isRowSelected(activeSheetIndex, rowIndex)}
                                  onCheckedChange={() => toggleRowSelection(activeSheetIndex, rowIndex)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              {/* Row Number Cell */}
                              <td className={`sticky left-12 z-10 w-20 px-4 py-3 border-r text-sm text-muted-foreground font-medium ${
                                isRowSelected(activeSheetIndex, rowIndex) ? 'bg-primary/10' : 'bg-background'
                              }`}>
                                {rowIndex + 1}
                              </td>
                              {/* Data Cells */}
                              {activeSheet.headers.map((header, cellIndex) => (
                                <td
                                  key={`cell-${rowIndex}-${cellIndex}`}
                                  className="min-w-[160px] px-4 py-3 text-sm border-r"
                                >
                                  <div className="truncate max-w-[140px]" title={formatCellValue(row[header])}>
                                    {formatCellValue(row[header])}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t flex-shrink-0">
          <div className="text-sm text-muted-foreground">
            {getTotalSelectionCount()} total rows selected across {getSelectedSheetsCount()} sheet{getSelectedSheetsCount() !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={confirmSelection}
              disabled={getTotalSelectionCount() === 0}
            >
              Add {getTotalSelectionCount()} Row{getTotalSelectionCount() !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

