// src/App.tsx
import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import { parseDocument } from './utils/documentParser';

interface KeywordAnalysis {
  jobKeywords: string[];
  missingKeywords: string[];
  matchedKeywords: string[];
  score: number;
}

const App: React.FC = () => {
  const [jobDescription, setJobDescription] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<KeywordAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    try {
      const result = await parseDocument(file);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.text;
    } catch (error) {
      console.error('Error extracting text from file:', error);
      throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!jobDescription) {
      setError('Please enter a job description');
      return;
    }
    
    if (!file) {
      setError('Please upload a resume');
      return;
    }
    
    if (!apiKey) {
      setError('Please enter your OpenAI API key');
      return;
    }
    
    setLoading(true);
    
    try {
      const resumeText = await extractTextFromFile(file);
      const analysis = await analyzeKeywords(jobDescription, resumeText);
      setResult(analysis);
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

  return (
    <div className="container">
      <h1>Resume Keyword Checker</h1>
      <p className="description">
        Enter a job description and upload your resume to see which keywords you might be missing.
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
              required
              style={{ display: 'none' }}
            />
            <label htmlFor="resume" className="file-input-button">
              Choose File
            </label>
            {fileName && <span className="file-name">{fileName}</span>}
          </div>
          <small>Supported formats: .txt, .pdf, .docx, .doc</small>
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Analyzing...
            </>
          ) : (
            'Analyze Resume'
          )}
        </button>
      </form>
      
      {error && <div className="error">{error}</div>}
      
      {result && (
        <div id="results-section" className="results">
          <h2>Analysis Results</h2>
          <div className="score">
            Match Score: {result.score}%
          </div>
          
          <div className="keywords-section">
            <h3>Important Job Keywords</h3>
            <div className="keyword-list">
              {result.jobKeywords.map((keyword, index) => (
                <span 
                  key={index} 
                  className={result.missingKeywords.includes(keyword) ? 'keyword missing' : 'keyword matched'}
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
          
          <div className="keywords-section">
            <h3>Missing Keywords</h3>
            {result.missingKeywords.length > 0 ? (
              <div className="keyword-list">
                {result.missingKeywords.map((keyword, index) => (
                  <span key={index} className="keyword missing">{keyword}</span>
                ))}
              </div>
            ) : (
              <p>Great job! Your resume contains all the important keywords.</p>
            )}
          </div>
          
          <div className="keywords-section">
            <h3>Matched Keywords</h3>
            <div className="keyword-list">
              {result.matchedKeywords.map((keyword, index) => (
                <span key={index} className="keyword matched">{keyword}</span>
              ))}
            </div>
          </div>
          
          <div className="recommendations">
            <h3>Recommendations</h3>
            <p>
              Consider adding the missing keywords to your resume to improve your chances of getting past ATS systems. 
              Make sure to incorporate them naturally and honestly based on your actual skills and experience.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;