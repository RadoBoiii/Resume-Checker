// src/utils/documentParser.ts
import mammoth from 'mammoth';

export interface ParserResult {
  text: string;
  error?: string;
  format?: string;
  structure?: any;
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
          error: '.doc files are not directly supported. Please convert to .docx or .pdf and try again.',
          format: 'doc'
        };
      case 'txt':
      default:
        return await parseTxt(file);
    }
  } catch (error) {
    console.error('Error parsing document:', error);
    return {
      text: '',
      error: `Failed to parse ${fileType} file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      format: fileType || 'unknown'
    };
  }
}

async function parseTxt(file: File): Promise<ParserResult> {
  try {
    const text = await file.text();
    return { 
      text,
      format: 'txt',
      structure: analyzeResumeStructure(text)
    };
  } catch (error) {
    throw new Error(`Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parsePDF(file: File): Promise<ParserResult> {
  try {
    // Import PDF.js dynamically
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
    
    // Set the worker source using CDN
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';
    console.log(`Using PDF.js worker from: ${pdfjs.GlobalWorkerOptions.workerSrc}`);
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document with minimal options for better compatibility
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
    });
    
    // Add error handler to the loading task
    loadingTask.onProgress = (progressData: {loaded: number, total: number}) => {
      console.log(`Loading PDF: ${(progressData.loaded / progressData.total * 100).toFixed(2)}%`);
    };
    
    // Get the PDF document
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
    
    const numPages = pdf.numPages;
    let text = '';
    
    // Extract text from each page with better error handling
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .filter((item: any) => 'str' in item)
          .map((item: any) => item.str)
          .join(' ');
        text += pageText + '\n';
      } catch (pageError) {
        console.error(`Error extracting text from page ${i}:`, pageError);
        text += `[Error extracting text from page ${i}]\n`;
      }
    }
    
    return { 
      text, 
      format: 'pdf',
      structure: analyzeResumeStructure(text)
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseDocx(file: File): Promise<ParserResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { 
      text: result.value,
      format: 'docx',
      structure: analyzeResumeStructure(result.value)
    };
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Function to analyze and identify resume structure
function analyzeResumeStructure(text: string): any {
  // Basic structure analysis - looking for sections and formatting patterns
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const structure: any = {
    sections: [],
    hasContactInfo: false,
    hasSummary: false,
    hasEducation: false,
    hasExperience: false,
    hasSkills: false,
    indentation: false,
    bulletPoints: false,
    lineSpacing: 'normal',
    formatType: 'unknown'
  };
  
  let currentSection = '';
  let sectionContent: string[] = [];
  
  // Detect common sections and formatting
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for section headers (all caps, colon ending, etc.)
    if (
      line === line.toUpperCase() && line.length > 3 && line.length < 30 ||
      /^(EDUCATION|EXPERIENCE|SKILLS|WORK HISTORY|SUMMARY|OBJECTIVE|PROJECTS|CERTIFICATIONS|LANGUAGES|INTERESTS|REFERENCES)/i.test(line)
    ) {
      // Save previous section if exists
      if (currentSection && sectionContent.length > 0) {
        structure.sections.push({
          title: currentSection,
          content: sectionContent.join('\n')
        });
      }
      
      // Start new section
      currentSection = line;
      sectionContent = [];
      
      // Mark known sections
      if (/EDUCATION|ACADEMIC/i.test(line)) structure.hasEducation = true;
      if (/EXPERIENCE|WORK|EMPLOYMENT|HISTORY/i.test(line)) structure.hasExperience = true;
      if (/SKILLS|EXPERTISE|TECHNOLOGIES|COMPETENCIES/i.test(line)) structure.hasSkills = true;
      if (/SUMMARY|PROFILE|OBJECTIVE/i.test(line)) structure.hasSummary = true;
      if (/CONTACT|INFO|ADDRESS|PHONE|EMAIL/i.test(line)) structure.hasContactInfo = true;
    } else {
      sectionContent.push(line);
      
      // Check for bullet points
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        structure.bulletPoints = true;
      }
      
      // Check for contact info patterns
      if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(line) || 
          /\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b/.test(line)) {
        structure.hasContactInfo = true;
      }
    }
  }
  
  // Add the last section
  if (currentSection && sectionContent.length > 0) {
    structure.sections.push({
      title: currentSection,
      content: sectionContent.join('\n')
    });
  }
  
  // Determine format type based on structure
  if (structure.bulletPoints && structure.sections.length >= 3) {
    structure.formatType = 'standard';
  } else if (structure.sections.length <= 2 && text.length > 200) {
    structure.formatType = 'narrative';
  } else if (text.includes('  ') || text.includes('\t')) {
    structure.formatType = 'tabular';
  }
  
  return structure;
}

// Generate a resume with a specific template
export function applyResumeTemplate(resumeText: string, templateName: string): string {
  // Extract core information from existing resume
  const structure = analyzeResumeStructure(resumeText);
  const sections = structure.sections;
  
  switch (templateName) {
    case 'professional':
      return generateProfessionalTemplate(resumeText, structure);
    case 'modern':
      return generateModernTemplate(resumeText, structure);
    case 'academic':
      return generateAcademicTemplate(resumeText, structure);
    case 'simple':
      return generateSimpleTemplate(resumeText, structure);
    default:
      return resumeText; // Return original if no template specified
  }
}

// Template generators
function generateProfessionalTemplate(resumeText: string, structure: any): string {
  // Extract data from original resume
  const nameMatch = resumeText.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
  const name = nameMatch ? nameMatch[0] : 'YOUR NAME';
  
  const emailMatch = resumeText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const email = emailMatch ? emailMatch[0] : 'email@example.com';
  
  const phoneMatch = resumeText.match(/\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b/);
  const phone = phoneMatch ? phoneMatch[0] : '(123) 456-7890';

  // Find summary section
  let summary = '';
  const summarySection = structure.sections.find((s: any) => 
    /SUMMARY|PROFILE|OBJECTIVE/i.test(s.title)
  );
  if (summarySection) {
    summary = summarySection.content;
  }

  // Build template
  let template = `${name}
${email} | ${phone}

PROFESSIONAL SUMMARY
${summary || 'Experienced professional with a track record of success...'}

`;

  // Add experience section
  const experienceSection = structure.sections.find((s: any) => 
    /EXPERIENCE|WORK|EMPLOYMENT|HISTORY/i.test(s.title)
  );
  if (experienceSection) {
    template += `PROFESSIONAL EXPERIENCE
${experienceSection.content}

`;
  }

  // Add education section
  const educationSection = structure.sections.find((s: any) => 
    /EDUCATION|ACADEMIC/i.test(s.title)
  );
  if (educationSection) {
    template += `EDUCATION
${educationSection.content}

`;
  }

  // Add skills section
  const skillsSection = structure.sections.find((s: any) => 
    /SKILLS|EXPERTISE|TECHNOLOGIES|COMPETENCIES/i.test(s.title)
  );
  if (skillsSection) {
    template += `SKILLS
${skillsSection.content}`;
  }

  return template;
}

function generateModernTemplate(resumeText: string, structure: any): string {
  // Similar to professional but with different formatting and order
  // Implementation would be similar to professional template but with different styling hints
  return resumeText; // Placeholder
}

function generateAcademicTemplate(resumeText: string, structure: any): string {
  // Academic CV format with publications, research, etc.
  // Implementation would extract and reformat for academic context
  return resumeText; // Placeholder
}

function generateSimpleTemplate(resumeText: string, structure: any): string {
  // Minimal, clean format
  // Implementation would extract core info and present in minimal format
  return resumeText; // Placeholder
}