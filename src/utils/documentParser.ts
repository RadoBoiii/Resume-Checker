// src/utils/documentParser.ts
import mammoth from 'mammoth';

export interface ParserResult {
  text: string;
  error?: string;
}

export async function parseDocument(file: File): Promise<ParserResult> {
  const fileType = file.name.split('.').pop()?.toLowerCase();
  
  try {
    switch (fileType) {
      case 'pdf':
        return await parsePDF(file);
      case 'docx':
        return await parseDocx(file);
      case 'doc':
        return {
          text: '',
          error: '.doc files are not directly supported. Please convert to .docx or .pdf and try again.'
        };
      case 'txt':
      default:
        return await parseTxt(file);
    }
  } catch (error) {
    console.error('Error parsing document:', error);
    return {
      text: '',
      error: `Failed to parse ${fileType} file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function parseTxt(file: File): Promise<ParserResult> {
  try {
    const text = await file.text();
    return { text };
  } catch (error) {
    throw new Error(`Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parsePDF(file: File): Promise<ParserResult> {
  try {
    // Import PDF.js dynamically
    const pdfjs = await import('pdfjs-dist');
    // Set the worker source
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    let text = '';
    
    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str)
        .join(' ');
      text += pageText + '\n';
    }
    
    return { text };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseDocx(file: File): Promise<ParserResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value };
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}