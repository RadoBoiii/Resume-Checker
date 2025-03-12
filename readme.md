# Resume Keyword Checker

A TypeScript React application that compares job descriptions with resumes to identify missing keywords using OpenAI's API.

## Features

- Upload resume files (supports .txt, .pdf, .docx)
- Enter job descriptions
- Analyze resumes against job descriptions
- Highlight missing and matched keywords
- Calculate resume-to-job match score
- Provide recommendations for improvement

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/resume-checker.git
   cd resume-checker
   ```

2. Install dependencies:
   ```
   npm install axios mammoth pdfjs-dist
   ```
   or
   ```
   yarn add axios mammoth pdfjs-dist
   ```

3. Create a `.env` file in the root directory and add your OpenAI API key (optional, since the app also allows runtime entry of the API key):
   ```
   REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the development server:
   ```
   npm start
   ```
   or
   ```
   yarn start
   ```

5. Open `http://localhost:3000` in your browser.

## Dependencies

- React
- TypeScript
- axios (for API requests)
- mammoth (for parsing .docx files)
- pdfjs-dist (for parsing PDF files)

## Project Structure

```
resume-checker/
├── public/
│   ├── index.html       # HTML entry point
│   ├── manifest.json    # Web app manifest
│   └── favicon.ico      # App icon
├── src/
│   ├── App.tsx          # Main application component
│   ├── App.css          # Styles for the application
│   ├── index.tsx        # React entry point
│   ├── index.css        # Global styles
│   ├── reportWebVitals.ts # Performance monitoring
│   ├── utils/
│   │   └── documentParser.ts  # Utility for parsing different document formats
│   └── ...
├── package.json         # Project dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## How It Works

1. The user enters a job description and uploads their resume.
2. The application extracts text from the resume using the appropriate parser based on file type.
3. The job description and resume text are sent to OpenAI's API for analysis.
4. The API identifies important keywords from the job description and checks if they appear in the resume.
5. The application displays the results, highlighting missing keywords and providing recommendations.

## Limitations

- PDF parsing may not extract text perfectly from all PDFs, especially those with complex formatting or scanned content.
- The analysis depends on OpenAI's API, which may have rate limits or costs associated with it.
- The application does not store any data persistently.

## Future Improvements

- Add support for more document formats
- Implement better PDF parsing
- Add ability to save results
- Provide more detailed recommendations for resume improvement
- Implement batch processing for multiple job descriptions


