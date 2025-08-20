import React from 'react';
import MarkdownPage from '../components/MarkdownPage';

// Import markdown content as raw text
import termsOfServiceContent from '../content/legal/terms-of-service.md?raw';

const TermsOfServicePage: React.FC = () => {
  return <MarkdownPage title="Terms of Service" content={termsOfServiceContent} />;
};

export default TermsOfServicePage;
