import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from "docx";
import jsPDF from "jspdf";

// Interface for parsed markdown structure
interface MarkdownElement {
  type: 'heading' | 'paragraph' | 'list' | 'bold' | 'italic' | 'code' | 'text' | 'table';
  level?: number; // For headings (1-6)
  content: string;
  children?: MarkdownElement[];
  rows?: string[][]; // For tables
  headers?: string[]; // For table headers
}

// Enhanced markdown parser that handles nested structures
export class MarkdownProcessor {
  private parseMarkdown(markdown: string): MarkdownElement[] {
    const lines = markdown.split('\n');
    const elements: MarkdownElement[] = [];
    let currentListItems: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Handle empty lines
      if (trimmedLine === '') {
        if (currentListItems.length > 0) {
          elements.push({
            type: 'list',
            content: '',
            children: currentListItems.map(item => ({
              type: 'text',
              content: item
            }))
          });
          currentListItems = [];
        }
        elements.push({ type: 'paragraph', content: '' });
        continue;
      }
      
      // Handle headings
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        if (currentListItems.length > 0) {
          elements.push({
            type: 'list',
            content: '',
            children: currentListItems.map(item => ({
              type: 'text',
              content: item
            }))
          });
          currentListItems = [];
        }
        elements.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2]
        });
        continue;
      }
      
      // Handle list items
      const listMatch = trimmedLine.match(/^[-*+]\s+(.*)$/);
      if (listMatch) {
        currentListItems.push(listMatch[1]);
        continue;
      }
      
      // Handle numbered lists
      const numberedListMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);
      if (numberedListMatch) {
        currentListItems.push(numberedListMatch[1]);
        continue;
      }
      
      // Handle tables
      if (trimmedLine.includes('|') && trimmedLine.length > 3) {
        // Check if this could be part of a table
        const isTableSeparator = /^\|?[\s\-\|:]+\|?$/.test(trimmedLine);
        const isTableRow = trimmedLine.startsWith('|') || trimmedLine.endsWith('|') || trimmedLine.split('|').length > 2;
        
        if (isTableRow && !isTableSeparator) {
          // Look ahead to see if we have a complete table
          const tableRows: string[] = [trimmedLine];
          let j = i + 1;
          let foundSeparator = false;
          
          // Check the next line for table separator
          if (j < lines.length) {
            const nextLine = lines[j].trim();
            if (/^\|?[\s\-\|:]+\|?$/.test(nextLine)) {
              foundSeparator = true;
              j++; // Skip separator row
              
              // Collect remaining table rows
              while (j < lines.length) {
                const rowLine = lines[j].trim();
                if (rowLine.includes('|') && rowLine.length > 3 && !rowLine.match(/^#{1,6}\s/)) {
                  tableRows.push(rowLine);
                  j++;
                } else {
                  break;
                }
              }
              
              if (tableRows.length >= 2) { // Header + at least one data row
                // Parse table
                const headers = tableRows[0].split('|').map(h => h.trim()).filter(h => h);
                const rows = tableRows.slice(1).map(row => 
                  row.split('|').map(cell => cell.trim()).filter(cell => cell)
                );
                
                // Ensure all previous list items are processed
                if (currentListItems.length > 0) {
                  elements.push({
                    type: 'list',
                    content: '',
                    children: currentListItems.map(item => ({
                      type: 'text',
                      content: item
                    }))
                  });
                  currentListItems = [];
                }
                
                elements.push({
                  type: 'table',
                  content: '',
                  headers,
                  rows
                });
                
                i = j - 1; // Skip processed table rows
                continue;
              }
            }
          }
        }
      }
      
      // If we have accumulated list items and this isn't a list item, output the list
      if (currentListItems.length > 0) {
        elements.push({
          type: 'list',
          content: '',
          children: currentListItems.map(item => ({
            type: 'text',
            content: item
          }))
        });
        currentListItems = [];
      }
      
      // Handle regular paragraphs with inline formatting
      if (trimmedLine) {
        elements.push({
          type: 'paragraph',
          content: trimmedLine
        });
      }
    }
    
    // Don't forget any remaining list items
    if (currentListItems.length > 0) {
      elements.push({
        type: 'list',
        content: '',
        children: currentListItems.map(item => ({
          type: 'text',
          content: item
        }))
      });
    }
    
    return elements;
  }
  
  // Parse inline formatting within text
  private parseInlineFormatting(text: string): TextRun[] {
    const textRuns: TextRun[] = [];
    let currentIndex = 0;
    
    // Regex to match bold (**text**), italic (*text*), and code (`text`)
    const formatRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
    let match;
    
    while ((match = formatRegex.exec(text)) !== null) {
      // Add any text before the match
      if (match.index > currentIndex) {
        const beforeText = text.slice(currentIndex, match.index);
        if (beforeText) {
          textRuns.push(new TextRun({
            text: beforeText,
            size: 20
          }));
        }
      }
      
      // Add the formatted text
      if (match[2]) { // Bold text
        textRuns.push(new TextRun({
          text: match[2],
          bold: true,
          size: 20
        }));
      } else if (match[3]) { // Italic text
        textRuns.push(new TextRun({
          text: match[3],
          italics: true,
          size: 20
        }));
      } else if (match[4]) { // Code text
        textRuns.push(new TextRun({
          text: match[4],
          font: "Courier New",
          size: 18
        }));
      }
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      if (remainingText) {
        textRuns.push(new TextRun({
          text: remainingText,
          size: 20
        }));
      }
    }
    
    // If no formatting was found, return the original text
    if (textRuns.length === 0) {
      textRuns.push(new TextRun({
        text: text,
        size: 20
      }));
    }
    
    return textRuns;
  }
  
  // Generate Word document with proper markdown rendering
  async generateWordDocument(title: string, sections: Array<{ title: string; value: string }>): Promise<Blob> {
    const children: (Paragraph | Table)[] = [];
    
    // Add main title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 },
        alignment: AlignmentType.CENTER,
      })
    );
    
    sections.forEach((section) => {
      if (section.value.trim()) {
        // Add section title
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: section.title,
                bold: true,
                size: 24,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        
        // Parse and process markdown content
        const elements = this.parseMarkdown(section.value);
        
        elements.forEach((element) => {
          switch (element.type) {
            case 'heading':
              const headingLevel = element.level === 1 ? HeadingLevel.HEADING_2 :
                                  element.level === 2 ? HeadingLevel.HEADING_3 :
                                  element.level === 3 ? HeadingLevel.HEADING_4 :
                                  element.level === 4 ? HeadingLevel.HEADING_5 :
                                  HeadingLevel.HEADING_6;
              
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: element.content,
                      bold: true,
                      size: Math.max(16, 26 - element.level! * 2),
                    }),
                  ],
                  heading: headingLevel,
                  spacing: { before: 200, after: 100 },
                })
              );
              break;
              
            case 'list':
              element.children?.forEach((listItem) => {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: "• ", size: 20 }),
                      ...this.parseInlineFormatting(listItem.content)
                    ],
                    spacing: { after: 100 },
                    indent: { left: 720 }, // Indent list items
                  })
                );
              });
              break;
              
            case 'table':
              if (element.headers && element.rows) {
                const tableRows: TableRow[] = [];
                
                // Add header row
                tableRows.push(
                  new TableRow({
                    children: element.headers.map(header => 
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: header,
                                bold: true,
                                size: 20
                              })
                            ]
                          })
                        ],
                        width: { size: 100 / element.headers!.length, type: WidthType.PERCENTAGE }
                      })
                    )
                  })
                );
                
                // Add data rows
                element.rows.forEach(row => {
                  tableRows.push(
                    new TableRow({
                      children: row.map(cell => 
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: this.parseInlineFormatting(cell)
                            })
                          ],
                          width: { size: 100 / element.headers!.length, type: WidthType.PERCENTAGE }
                        })
                      )
                    })
                  );
                });
                
                children.push(
                  new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE }
                  })
                );
                
                // Add spacing after table
                children.push(
                  new Paragraph({
                    children: [new TextRun({ text: "" })],
                    spacing: { after: 200 },
                  })
                );
              }
              break;
              
            case 'paragraph':
              if (element.content.trim()) {
                children.push(
                  new Paragraph({
                    children: this.parseInlineFormatting(element.content),
                    spacing: { after: 200 },
                  })
                );
              } else {
                children.push(
                  new Paragraph({
                    children: [new TextRun({ text: "" })],
                    spacing: { after: 100 },
                  })
                );
              }
              break;
          }
        });
      }
    });
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: children,
      }],
    });
    
    return await Packer.toBlob(doc);
  }
  
  // Generate PDF with proper markdown rendering
  generatePDF(title: string, sections: Array<{ title: string; value: string }>): jsPDF {
    const pdf = new jsPDF();
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 20;
    const lineHeight = 6;
    let yPosition = margin;
    
    // Title
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    const titleLines = pdf.splitTextToSize(title, pageWidth - 2 * margin);
    titleLines.forEach((line: string) => {
      pdf.text(line, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
    });
    yPosition += 10;
    
    sections.forEach((section) => {
      if (section.value.trim()) {
        // Check if we need a new page for the section
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // Section title
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        const sectionTitleLines = pdf.splitTextToSize(section.title, pageWidth - 2 * margin);
        sectionTitleLines.forEach((line: string) => {
          pdf.text(line, margin, yPosition);
          yPosition += 8;
        });
        yPosition += 5;
        
        // Parse and process markdown content
        const elements = this.parseMarkdown(section.value);
        
        elements.forEach((element) => {
          switch (element.type) {
            case 'heading':
              if (yPosition > pageHeight - 30) {
                pdf.addPage();
                yPosition = margin;
              }
              
              const fontSize = Math.max(11, 18 - element.level! * 1);
              pdf.setFontSize(fontSize);
              pdf.setFont("helvetica", "bold");
              
              const headingLines = pdf.splitTextToSize(element.content, pageWidth - 2 * margin);
              headingLines.forEach((line: string) => {
                pdf.text(line, margin, yPosition);
                yPosition += lineHeight + 2;
              });
              yPosition += 3;
              break;
              
            case 'list':
              element.children?.forEach((listItem) => {
                if (yPosition > pageHeight - 20) {
                  pdf.addPage();
                  yPosition = margin;
                }
                
                pdf.setFontSize(11);
                pdf.setFont("helvetica", "normal");
                
                // Process inline formatting in list items - remove markdown markers
                const processedContent = listItem.content
                  .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markers for PDF
                  .replace(/\*(.*?)\*/g, '$1')     // Remove italic markers for PDF
                  .replace(/`(.*?)`/g, '$1');      // Remove code markers for PDF
                
                const bulletText = "• " + processedContent;
                const listLines = pdf.splitTextToSize(bulletText, pageWidth - 2 * margin - 20);
                listLines.forEach((line: string, index: number) => {
                  pdf.text(line, margin + (index === 0 ? 0 : 20), yPosition);
                  yPosition += lineHeight;
                });
              });
              yPosition += 2;
              break;
              
            case 'table':
              if (element.headers && element.rows) {
                // Calculate dynamic column widths based on content
                const availableWidth = pageWidth - 2 * margin;
                const minColWidth = 45; // Minimum column width
                const maxColWidth = availableWidth / 2; // Maximum column width for any single column
                
                // Calculate content-based widths
                const columnWidths: number[] = [];
                for (let colIndex = 0; colIndex < element.headers.length; colIndex++) {
                  let maxContentLength = element.headers[colIndex].length;
                  element.rows.forEach(row => {
                    if (row[colIndex]) {
                      maxContentLength = Math.max(maxContentLength, row[colIndex].length);
                    }
                  });
                  
                  // Scale width based on content, with min/max constraints
                  let colWidth = Math.max(minColWidth, Math.min(maxColWidth, maxContentLength * 3));
                  columnWidths.push(colWidth);
                }
                
                // Normalize to fit available width
                const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
                if (totalWidth > availableWidth) {
                  const scale = availableWidth / totalWidth;
                  columnWidths.forEach((width, index) => {
                    columnWidths[index] = width * scale;
                  });
                }
                
                // Helper function to calculate row height with proper wrapping
                const calculateRowHeight = (row: string[]): number => {
                  let maxLines = 1;
                  row.forEach((cell, colIndex) => {
                    if (cell && colIndex < columnWidths.length) {
                      const processedCell = cell
                        .replace(/\*\*(.*?)\*\*/g, '$1')
                        .replace(/\*(.*?)\*/g, '$1')
                        .replace(/`(.*?)`/g, '$1');
                      const cellLines = pdf.splitTextToSize(processedCell, columnWidths[colIndex] - 6);
                      maxLines = Math.max(maxLines, cellLines.length);
                    }
                  });
                  return Math.max(maxLines * 4.5 + 8, 18); // Minimum row height of 18
                };
                
                // Helper function to draw table header
                const drawTableHeader = (startY: number): number => {
                  const headerHeight = calculateRowHeight(element.headers);
                  
                  // Ensure we have space for header
                  if (startY + headerHeight > pageHeight - margin) {
                    pdf.addPage();
                    startY = margin;
                  }
                  
                  // Draw header background
                  pdf.setFillColor(230, 230, 230);
                  pdf.rect(margin, startY, availableWidth, headerHeight, 'F');
                  
                  // Draw header text
                  pdf.setFont("helvetica", "bold");
                  pdf.setFontSize(7);
                  pdf.setTextColor(0, 0, 0);
                  
                  element.headers.forEach((header, colIndex) => {
                    if (colIndex < columnWidths.length) {
                      const xPos = margin + columnWidths.slice(0, colIndex).reduce((sum, w) => sum + w, 0);
                      const cellLines = pdf.splitTextToSize(header, columnWidths[colIndex] - 6);
                      
                      cellLines.forEach((line: string, lineIndex: number) => {
                        pdf.text(line, xPos + 3, startY + 6 + (lineIndex * 4.5));
                      });
                    }
                  });
                  
                  // Draw header borders
                  pdf.setDrawColor(0, 0, 0);
                  pdf.setLineWidth(0.3);
                  
                  // Outer border
                  pdf.rect(margin, startY, availableWidth, headerHeight);
                  
                  // Vertical lines
                  let xOffset = margin;
                  for (let i = 0; i < columnWidths.length - 1; i++) {
                    xOffset += columnWidths[i];
                    pdf.line(xOffset, startY, xOffset, startY + headerHeight);
                  }
                  
                  return startY + headerHeight;
                };
                
                // Helper function to draw a table row that handles splitting across pages
                const drawTableRow = (row: string[], startY: number): number => {
                  const maxRowHeight = pageHeight - margin - startY - 20; // Leave space at bottom
                  const idealRowHeight = calculateRowHeight(row);
                  
                  // If row is too tall for remaining space, move to next page
                  if (idealRowHeight > maxRowHeight && maxRowHeight < 50) {
                    pdf.addPage();
                    startY = margin;
                    // Redraw header on new page
                    startY = drawTableHeader(startY);
                  }
                  
                  // Calculate actual row height for current page
                  const availableHeight = pageHeight - margin - startY - 10;
                  const rowHeight = Math.min(idealRowHeight, availableHeight);
                  
                  // Draw row background
                  pdf.setFillColor(255, 255, 255);
                  pdf.rect(margin, startY, availableWidth, rowHeight, 'F');
                  
                  // Draw row text with proper wrapping and clipping
                  pdf.setFont("helvetica", "normal");
                  pdf.setFontSize(7);
                  pdf.setTextColor(0, 0, 0);
                  
                  const cellContents: string[][] = []; // Store split content for potential continuation
                  
                  row.forEach((cell, colIndex) => {
                    if (colIndex < columnWidths.length) {
                      const xPos = margin + columnWidths.slice(0, colIndex).reduce((sum, w) => sum + w, 0);
                      const processedCell = (cell || '')
                        .replace(/\*\*(.*?)\*\*/g, '$1')
                        .replace(/\*(.*?)\*/g, '$1')
                        .replace(/`(.*?)`/g, '$1');
                      
                      const cellLines = pdf.splitTextToSize(processedCell, columnWidths[colIndex] - 6);
                      cellContents[colIndex] = cellLines;
                      
                      // Draw as many lines as fit in the current row height
                      const maxLinesInRow = Math.floor((rowHeight - 8) / 4.5);
                      const linesToDraw = cellLines.slice(0, maxLinesInRow);
                      
                      linesToDraw.forEach((line: string, lineIndex: number) => {
                        if (startY + 6 + (lineIndex * 4.5) < pageHeight - margin) {
                          pdf.text(line, xPos + 3, startY + 6 + (lineIndex * 4.5));
                        }
                      });
                    }
                  });
                  
                  // Draw row borders
                  pdf.setDrawColor(0, 0, 0);
                  pdf.setLineWidth(0.3);
                  
                  // Outer border
                  pdf.rect(margin, startY, availableWidth, rowHeight);
                  
                  // Vertical lines
                  let xOffset = margin;
                  for (let i = 0; i < columnWidths.length - 1; i++) {
                    xOffset += columnWidths[i];
                    pdf.line(xOffset, startY, xOffset, startY + rowHeight);
                  }
                  
                  // Check if we need to continue this row on next page
                  const maxLinesDrawn = Math.floor((rowHeight - 8) / 4.5);
                  const hasMoreContent = cellContents.some(lines => lines && lines.length > maxLinesDrawn);
                  
                  if (hasMoreContent) {
                    // Continue on next page
                    pdf.addPage();
                    let newY = margin;
                    newY = drawTableHeader(newY);
                    
                    // Draw continuation of the row
                    const remainingLines = cellContents.map(lines => 
                      lines ? lines.slice(maxLinesDrawn) : []
                    );
                    
                    if (remainingLines.some(lines => lines.length > 0)) {
                      return drawTableRow(remainingLines.map(lines => lines.join(' ')), newY);
                    }
                    
                    return newY;
                  }
                  
                  return startY + rowHeight;
                };
                
                // Start rendering the table
                const headerHeight = calculateRowHeight(element.headers);
                const minSpaceNeeded = headerHeight + 30; // Header + minimum space for content
                
                // Check if we need a new page to start the table
                if (yPosition + minSpaceNeeded > pageHeight - margin) {
                  pdf.addPage();
                  yPosition = margin;
                }
                
                // Draw table header
                yPosition = drawTableHeader(yPosition);
                
                // Draw data rows with proper page breaks and overflow handling
                element.rows.forEach((row, rowIndex) => {
                  yPosition = drawTableRow(row, yPosition);
                });
                
                // Ensure proper spacing after table and reset position tracking
                yPosition = Math.min(yPosition + 15, pageHeight - margin - 20);
                
                // If we're too close to bottom, start fresh on next page
                if (yPosition > pageHeight - margin - 30) {
                  pdf.addPage();
                  yPosition = margin;
                }
              }
              break;
              
            case 'paragraph':
              if (element.content.trim()) {
                if (yPosition > pageHeight - 20) {
                  pdf.addPage();
                  yPosition = margin;
                }
                
                pdf.setFontSize(11);
                pdf.setFont("helvetica", "normal");
                
                // Handle inline formatting by processing bold and italic text
                const processedText = element.content
                  .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markers for PDF
                  .replace(/\*(.*?)\*/g, '$1')     // Remove italic markers for PDF
                  .replace(/`(.*?)`/g, '$1');      // Remove code markers for PDF
                
                const paragraphLines = pdf.splitTextToSize(processedText, pageWidth - 2 * margin);
                paragraphLines.forEach((line: string) => {
                  pdf.text(line, margin, yPosition);
                  yPosition += lineHeight;
                });
                yPosition += 3;
              } else {
                yPosition += lineHeight / 2; // Empty paragraph spacing
              }
              break;
          }
        });
        
        yPosition += 10; // Space between sections
      }
    });
    
    return pdf;
  }
}