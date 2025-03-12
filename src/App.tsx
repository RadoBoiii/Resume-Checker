// src/App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import './App.css';
import { parseDocument, applyResumeTemplate } from './utils/documentParser';

interface KeywordAnalysis {
  jobKeywords: string[];
  missingKeywords: string[];
  matchedKeywords: string[];
  score: number;
}

interface ResumeEdit {
  originalText: string;
  enhancedText: string;
  changes: string[];
  templateName?: string;
}

const App: React.FC = () => {
  const [jobDescription, setJobDescription] = useState<string>('');
  const [resumeText, setResumeText] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<string>('');
  const [fileStructure, setFileStructure] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [keywordResult, setKeywordResult] = useState<KeywordAnalysis | null>(null);
  const [resumeEdit, setResumeEdit] = useState<ResumeEdit | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'enhanced' | 'template'>('original');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('original');
  const [templatePreview, setTemplatePreview] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileError(null);
      
      try {
        setIsProcessingFile(true);
        const result = await parseDocument(selectedFile);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        setResumeText(result.text);
        setFileFormat(result.format || '');
        setFileStructure(result.structure || null);
        
        // Reset template selection when new file is uploaded
        setSelectedTemplate('original');
        setTemplatePreview('');
        
      } catch (err) {
        setFileError(err instanceof Error ? err.message : 'Failed to extract text from file');
      } finally {
        setIsProcessingFile(false);
      }
    }
  };

  const analyzeKeywords = async (jobDescription: string, resumeText: string): Promise<KeywordAnalysis> => {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert ATS system and resume analyzer. Extract key skills and requirements from job descriptions and compare them against resumes.'
            },
            {
              role: 'user',
              content: `Analyze this job description and resume. Extract important keywords from the job description, and tell me which ones are missing from the resume. Format your response as a JSON object with these properties: "jobKeywords" (array of strings), "missingKeywords" (array of strings), "matchedKeywords" (array of strings), and "score" (number from 0-100 representing match percentage).

Job Description:
${jobDescription}

Resume:
${resumeText}`
            }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('OpenAI API error:', error.response.data);
        throw new Error(`OpenAI API error: ${error.response.data.error?.message || 'Unknown API error'}`);
      }
      console.error('Error analyzing keywords:', error);
      throw new Error('Failed to analyze keywords with OpenAI API');
    }
  };

  const enhanceResume = async (jobDescription: string, resumeText: string, missingKeywords: string[], preserveFormat: boolean = true): Promise<ResumeEdit> => {
    try {
      const formatPrompt = preserveFormat 
        ? `Important: Maintain the EXACT same formatting, section structure, and layout as the original resume. Don't add or remove sections.` 
        : `Optimize the resume format for ATS systems.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: `You are an expert resume writer who helps job seekers optimize their resumes for specific job descriptions. ${formatPrompt}`
            },
            {
              role: 'user',
              content: `Enhance this resume to better match the job description. Incorporate the missing keywords naturally and honestly. 
              Focus on reformatting and rewording existing content rather than inventing new experiences.
              ${preserveFormat ? 'Remember to preserve the exact same format and layout as the original resume.' : ''}
              
              Job Description:
              ${jobDescription}
              
              Resume:
              ${resumeText}
              
              Missing Keywords: ${missingKeywords.join(', ')}
              
              Format your response as a JSON object with these properties:
              - "enhancedText" (string): The complete enhanced resume
              - "changes" (array of strings): A list of specific improvements made to the resume`
            }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      return {
        originalText: resumeText,
        enhancedText: result.enhancedText,
        changes: result.changes
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('OpenAI API error:', error.response.data);
        throw new Error(`OpenAI API error: ${error.response.data.error?.message || 'Unknown API error'}`);
      }
      console.error('Error enhancing resume:', error);
      throw new Error('Failed to enhance resume with OpenAI API');
    }
  };
  
  const retryFileUpload = async () => {
    if (!file) return;
    
    setFileError(null);
    try {
      setIsProcessingFile(true);
      const result = await parseDocument(file);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setResumeText(result.text);
      setFileFormat(result.format || '');
      setFileStructure(result.structure || null);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to extract text from file');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleResumeTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResumeText(e.target.value);
    // Reset results when resume text changes
    if (resumeEdit) {
      setResumeEdit(null);
    }
    if (keywordResult) {
      setKeywordResult(null);
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const template = e.target.value;
    setSelectedTemplate(template);
    
    if (template !== 'original' && resumeEdit) {
      const formattedResume = applyResumeTemplate(resumeEdit.enhancedText, template);
      setTemplatePreview(formattedResume);
      setActiveTab('template');
    } else if (template === 'original' && resumeEdit) {
      setActiveTab('enhanced');
    }
  };

  const downloadAsTxt = () => {
    if (!resumeEdit) return;
    
    let textToDownload = '';
    
    if (activeTab === 'original') {
      textToDownload = resumeEdit.originalText;
    } else if (activeTab === 'enhanced') {
      textToDownload = resumeEdit.enhancedText;
    } else if (activeTab === 'template') {
      textToDownload = templatePreview;
    }
    
    const element = document.createElement('a');
    const file = new Blob([textToDownload], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    
    // Generate filename
    const fileNameWithoutExtension = fileName.split('.')[0] || 'resume';
    let suffix = '';
    
    if (activeTab === 'enhanced') {
      suffix = '_enhanced';
    } else if (activeTab === 'template') {
      suffix = `_${selectedTemplate}`;
    }
    
    element.download = `${fileNameWithoutExtension}${suffix}.txt`;
    
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadAsDocx = async () => {
    if (!resumeEdit) return;
    
    let textToDownload = '';
    
    if (activeTab === 'original') {
      textToDownload = resumeEdit.originalText;
    } else if (activeTab === 'enhanced') {
      textToDownload = resumeEdit.enhancedText;
    } else if (activeTab === 'template') {
      textToDownload = templatePreview;
    }
    
    // Split resume text into lines for paragraphs
    const lines = textToDownload.split('\n');
    
    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: lines.map(line => 
            new Paragraph({
              children: [new TextRun(line)],
              spacing: {
                after: 200
              }
            })
          )
        }
      ]
    });
    
    // Generate blob from document
    const blob = await Packer.toBlob(doc);
    
    // Determine filename
    const fileNameWithoutExtension = fileName.split('.')[0] || 'resume';
    let suffix = '';
    
    if (activeTab === 'enhanced') {
      suffix = '_enhanced';
    } else if (activeTab === 'template') {
      suffix = `_${selectedTemplate}`;
    }
    
    const docxFileName = `${fileNameWithoutExtension}${suffix}.docx`;
    
    // Save file
    saveAs(blob, docxFileName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!jobDescription) {
      setError('Please enter a job description');
      return;
    }
    
    if (!resumeText) {
      setError('Please upload a resume or enter resume text');
      return;
    }
    
    if (!apiKey) {
      setError('Please enter your OpenAI API key');
      return;
    }
    
    setLoading(true);
    
    try {
      // First analyze keywords
      const analysis = await analyzeKeywords(jobDescription, resumeText);
      setKeywordResult(analysis);
      
      // Then enhance the resume based on missing keywords
      if (analysis.missingKeywords.length > 0) {
        // Pass preserveFormat=true to maintain original format
        const enhancedResume = await enhanceResume(jobDescription, resumeText, analysis.missingKeywords, true);
        setResumeEdit(enhancedResume);
        
        // Reset template view
        setSelectedTemplate('original');
        setTemplatePreview('');
        
        // Switch to enhanced tab
        setActiveTab('enhanced');
      }
      
      // Scroll to results
      setTimeout(() => {
        const resultsElement = document.getElementById('results-section');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteManually = () => {
    setFileError(null);
    setResumeText('');
    setFile(null);
    setFileName('');
  };

  return (
    <div className="container">
      <h1>Resume Optimizer</h1>
      <p className="description">
        Upload your resume and enter a job description to get real-time optimization suggestions.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="apiKey">OpenAI API Key:</label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your OpenAI API key"
            required
          />
          <small>Your API key is not stored and is only used for this analysis.</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="jobDescription">Job Description:</label>
          <textarea
            id="jobDescription"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="resume">Your Resume:</label>
          <div className="file-input-container">
            <input
              type="file"
              id="resume"
              onChange={handleFileChange}
              accept=".txt,.pdf,.docx,.doc"
              style={{ display: 'none' }}
            />
            <label htmlFor="resume" className="file-input-button">
              Upload Resume
            </label>
            {fileName && <span className="file-name">{fileName}</span>}
            {isProcessingFile && <span className="file-loading">Processing file...</span>}
          </div>
          <small>Supported formats: .txt, .pdf, .docx, .doc</small>
          
          {fileError && (
            <div className="file-error">
              <div className="error-message">
                <strong>Error:</strong> {fileError}
              </div>
              <div className="error-actions">
                <button type="button" className="retry-button" onClick={retryFileUpload}>
                  Reload
                </button>
                <button 
                  type="button" 
                  className="manual-entry-button"
                  onClick={handlePasteManually}
                >
                  Paste Text Manually
                </button>
              </div>
            </div>
          )}
          
          {(!resumeText && !fileError) || (fileError && !resumeText) ? (
            <div className="resume-text-container manual-mode">
              <label htmlFor="resumeTextManual">Or paste your resume content directly:</label>
              <textarea
                id="resumeTextManual"
                value={resumeText}
                onChange={handleResumeTextChange}
                placeholder="Paste your resume content here..."
                rows={10}
              />
            </div>
          ) : resumeText && !fileError ? (
            <div className="resume-text-container">
              <label htmlFor="resumeText">Resume Content:</label>
              <textarea
                id="resumeText"
                value={resumeText}
                onChange={handleResumeTextChange}
                placeholder="Your resume content will appear here. You can edit it if needed."
              />
            </div>
          ) : null}
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Optimizing Resume...
            </>
          ) : (
            'Optimize Resume'
          )}
        </button>
      </form>
      
      {error && <div className="error">{error}</div>}
      
      {keywordResult && (
        <div id="results-section" className="results">
          <h2>Analysis Results</h2>
          <div className="score">
            Match Score: {keywordResult.score}%
          </div>
          
          <div className="keywords-section">
            <h3>Important Job Keywords</h3>
            <div className="keyword-list">
              {keywordResult.jobKeywords.map((keyword, index) => (
                <span 
                  key={index} 
                  className={keywordResult.missingKeywords.includes(keyword) ? 'keyword missing' : 'keyword matched'}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
          
          <div className="keywords-section">
            <h3>Missing Keywords</h3>
            {keywordResult.missingKeywords.length > 0 ? (
              <div className="keyword-list">
                {keywordResult.missingKeywords.map((keyword, index) => (
                  <span key={index} className="keyword missing">{keyword}</span>
                ))}
              </div>
            ) : (
              <p>Great job! Your resume contains all the important keywords.</p>
            )}
          </div>
          
          {resumeEdit && (
            <div className="resume-editor">
              <h2>Resume Editor</h2>
              
              <div className="format-controls">
                <div className="template-selector">
                  <label htmlFor="template-select">Format Options:</label>
                  <select 
                    id="template-select" 
                    value={selectedTemplate}
                    onChange={handleTemplateChange}
                  >
                    <option value="original">Preserve Original Format</option>
                    <option value="professional">Professional Template</option>
                    <option value="modern">Modern Template</option>
                    <option value="simple">Simple Template</option>
                    <option value="academic">Academic Template</option>
                  </select>
                </div>
              </div>
              
              <div className="tabs">
                <button 
                  className={activeTab === 'original' ? 'tab active' : 'tab'}
                  onClick={() => setActiveTab('original')}
                >
                  Original
                </button>
                <button 
                  className={activeTab === 'enhanced' ? 'tab active' : 'tab'}
                  onClick={() => setActiveTab('enhanced')}
                >
                  Enhanced
                </button>
                {templatePreview && (
                  <button 
                    className={activeTab === 'template' ? 'tab active' : 'tab'}
                    onClick={() => setActiveTab('template')}
                  >
                    Template View
                  </button>
                )}
                <div className="download-options">
                  <button className="tab-action" onClick={downloadAsTxt}>
                    Download as TXT
                  </button>
                  <button className="tab-action" onClick={downloadAsDocx}>
                    Download as DOCX
                  </button>
                </div>
              </div>
              
              <div className="resume-content">
                {activeTab === 'original' ? (
                  <pre>{resumeEdit.originalText}</pre>
                ) : activeTab === 'enhanced' ? (
                  <pre>{resumeEdit.enhancedText}</pre>
                ) : (
                  <pre>{templatePreview}</pre>
                )}
              </div>
              
              <div className="changes-section">
                <h3>Improvements Made:</h3>
                <ul>
                  {resumeEdit.changes.map((change, index) => (
                    <li key={index}>{change}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;