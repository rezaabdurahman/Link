import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPageProps {
  title: string;
  content: string;
  className?: string;
}

const MarkdownPage: React.FC<MarkdownPageProps> = ({ title, content, className = '' }) => {
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen bg-surface-light ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-border-light sticky top-0 z-10">
        <div className="flex items-center px-4 py-4 max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-hover transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
          <h1 className="text-xl font-semibold text-text-primary ml-4">{title}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="prose prose-gray max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-3xl font-bold text-text-primary mb-6 pb-2 border-b border-border-light">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold text-text-primary mb-4 mt-8">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium text-text-primary mb-3 mt-6">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-text-primary mb-4 leading-relaxed">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-2 mb-4 text-text-secondary">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-2 mb-4 text-text-secondary">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-text-secondary">
                  {children}
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-text-primary">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="italic text-text-primary">
                  {children}
                </em>
              ),
              code: ({ children }) => (
                <code className="bg-surface-light px-2 py-1 rounded text-sm font-mono text-text-primary">
                  {children}
                </code>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary-500 pl-4 py-2 bg-surface-light rounded-r mb-4">
                  {children}
                </blockquote>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary-600 hover:text-primary-700 underline"
                  target={href?.startsWith('http') ? '_blank' : undefined}
                  rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {children}
                </a>
              )
            }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownPage;
