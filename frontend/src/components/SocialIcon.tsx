import React from 'react';
import { 
  FaInstagram, 
  FaTwitter, 
  FaFacebook, 
  FaSpotify, 
  FaLinkedin, 
  FaTiktok 
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

interface SocialIconProps {
  provider: string;
  size?: number;
  className?: string;
}

const SocialIcon: React.FC<SocialIconProps> = ({ provider, size = 20, className = '' }) => {
  const iconProps = {
    size,
    className
  };

  switch (provider) {
    case 'instagram':
      return <FaInstagram {...iconProps} style={{ color: '#E4405F' }} />;
    case 'x':
    case 'twitter':
      return <FaXTwitter {...iconProps} style={{ color: '#000000' }} />;
    case 'facebook':
      return <FaFacebook {...iconProps} style={{ color: '#1877F2' }} />;
    case 'spotify':
      return <FaSpotify {...iconProps} style={{ color: '#1DB954' }} />;
    case 'linkedin':
      return <FaLinkedin {...iconProps} style={{ color: '#0A66C2' }} />;
    case 'tiktok':
      return <FaTiktok {...iconProps} style={{ color: '#000000' }} />;
    default:
      // Fallback icon or null
      return <div {...iconProps} style={{ background: '#ccc', borderRadius: '50%' }} />;
  }
};

export default SocialIcon;
