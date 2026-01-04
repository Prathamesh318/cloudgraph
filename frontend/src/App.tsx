import { useState, useCallback } from 'react';
import './App.css';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { analyzeFiles, SAMPLE_DOCKER_COMPOSE, SAMPLE_KUBERNETES } from './services/api';
import type { AnalysisResult, FileInput } from './types';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [files, setFiles] = useState<FileInput[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleFilesChange = useCallback((newFiles: FileInput[]) => {
    setFiles(newFiles);
    setError(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (files.length === 0) {
      setError('Please upload at least one file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await analyzeFiles(files, { inferDependencies: true });
      if (response.result) {
        setAnalysisResult(response.result);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [files]);

  const handleSampleLoad = useCallback(async (type: 'docker' | 'k8s') => {
    const sampleFiles: FileInput[] = type === 'docker'
      ? [{ name: 'docker-compose.yml', content: SAMPLE_DOCKER_COMPOSE }]
      : [{ name: 'kubernetes.yaml', content: SAMPLE_KUBERNETES }];

    setFiles(sampleFiles);
    setIsLoading(true);
    setError(null);

    try {
      const response = await analyzeFiles(sampleFiles, { inferDependencies: true });
      if (response.result) {
        setAnalysisResult(response.result);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setFiles([]);
    setAnalysisResult(null);
    setError(null);
  }, []);

  return (
    <div className="app">
      <Navbar
        theme={theme}
        onThemeToggle={toggleTheme}
        onReset={analysisResult ? handleReset : undefined}
      />

      <main className="main-content">
        {!analysisResult ? (
          <FileUpload
            files={files}
            onFilesChange={handleFilesChange}
            onAnalyze={handleAnalyze}
            onSampleLoad={handleSampleLoad}
            isLoading={isLoading}
            error={error}
          />
        ) : (
          <Dashboard
            result={analysisResult}
            files={files}
          />
        )}
      </main>

      <footer className="footer">
        <p>CloudGraph — Container Orchestration Dependency Analyzer</p>
      </footer>
    </div>
  );
}

export default App;
