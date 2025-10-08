import mammoth from "mammoth";
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using proper path
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ExtractedContent {
  filename: string;
  content: string;
  pageCount?: number;
}

export const extractTextFromTxt = async (file: File): Promise<ExtractedContent> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve({
        filename: file.name,
        content: content.trim()
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
};

export const extractTextFromDocx = async (file: File): Promise<ExtractedContent> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Use mammoth.js to extract text from DOCX
        const result = await mammoth.extractRawText({ arrayBuffer });
        
        resolve({
          filename: file.name,
          content: result.value.trim()
        });
      } catch (error) {
        reject(new Error(`Failed to extract text from ${file.name}: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
};

export const extractTextFromPdf = async (file: File): Promise<ExtractedContent> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        if (!arrayBuffer) {
          throw new Error('Failed to read file as ArrayBuffer');
        }

        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer
        });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContentItems = await page.getTextContent({
            includeMarkedContent: true
          });
          
          if (i > 1) {
            fullText += `\n\n--- Page ${i} ---\n\n`;
          }
          
          // Combine all text items from the page
          const pageText = textContentItems.items
            .map((item: any) => item.str || '')
            .join(' ')
            .trim();
          
          if (pageText) {
            fullText += pageText;
          }
        }
        
        resolve({
          filename: file.name,
          content: fullText.trim(),
          pageCount: pdf.numPages
        });
      } catch (error) {
        reject(new Error(`Failed to extract text from ${file.name}: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
};

export const extractTextFromFile = async (file: File): Promise<ExtractedContent> => {
  const extension = file.name.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'txt':
      return extractTextFromTxt(file);
    case 'docx':
      return extractTextFromDocx(file);
    case 'pdf':
      return extractTextFromPdf(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
};

export const formatExtractedContent = (extractedFiles: ExtractedContent[]): string => {
  return extractedFiles.map(file => {
    let content = `\n\n=== ${file.filename} ===\n\n${file.content}`;
    return content;
  }).join('\n\n');
};