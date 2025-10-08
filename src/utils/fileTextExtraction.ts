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

// List of text-based file extensions that can be read as plain text
const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'json', 'xml', 'csv', 'yaml', 'yml', 'toml',
  'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'html', 'css', 'scss', 'sass', 'less',
  'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt',
  'sql', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'log', 'env', 'ini', 'conf', 'config', 'gitignore', 'dockerfile'
];

export const extractTextFromFile = async (file: File): Promise<ExtractedContent> => {
  const extension = file.name.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'docx':
      return extractTextFromDocx(file);
    case 'pdf':
      return extractTextFromPdf(file);
    default:
      // Check if it's a text-based file
      if (extension && TEXT_EXTENSIONS.includes(extension)) {
        return extractTextFromTxt(file);
      }
      throw new Error(`Unsupported file type: ${extension}`);
  }
};

export const formatExtractedContent = (extractedFiles: ExtractedContent[]): string => {
  return extractedFiles.map(file => {
    // Skip boundary markers for JSON files to avoid parsing issues
    const isJsonFile = file.filename.toLowerCase().endsWith('.json');
    let content = isJsonFile 
      ? `\n\n${file.content}` 
      : `\n\n=== ${file.filename} ===\n\n${file.content}`;
    return content;
  }).join('\n\n');
};