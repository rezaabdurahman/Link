import React from 'react';
import MarkdownPage from '../components/MarkdownPage';

// Import markdown content as raw text
import privacyPolicyContent from '../content/legal/privacy-policy.md?raw';

const PrivacyPolicyPage: React.FC = () => {
  return <MarkdownPage title="Privacy Policy" content={privacyPolicyContent} />;
};

export default PrivacyPolicyPage;
