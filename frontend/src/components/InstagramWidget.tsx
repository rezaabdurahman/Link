import React from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import { FaInstagram } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface InstagramWidgetProps {
  className?: string;
}

const InstagramWidget: React.FC<InstagramWidgetProps> = ({ className = '' }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`ios-card max-w-md mx-auto overflow-hidden ${className}`}
      style={{
        background: 'white',
        borderRadius: '16px',
        border: '2px solid transparent',
        backgroundImage: 'linear-gradient(white, white), linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'content-box, border-box',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        padding: '0'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {/* Profile Picture */}
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face"
              alt="Instagram User"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Username and Instagram Logo */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">alexthompson</span>
            <FaInstagram size={12} className="text-pink-500" />
          </div>
        </div>
        
        {/* More Options */}
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <MoreHorizontal size={16} className="text-gray-600" />
        </button>
      </div>

      {/* Image Content */}
      <div className="relative">
        <img
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop"
          alt="Instagram Post"
          className="w-full aspect-square object-cover"
        />
        
        {/* Story/Repost Indicator */}
        <div className="absolute top-3 left-3">
          <div className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-aqua rounded-full animate-pulse"></div>
            <span>Reposted</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button className="hover:scale-110 transition-transform">
              <Heart size={20} className="text-gray-800 hover:text-red-500 transition-colors" />
            </button>
            <button className="hover:scale-110 transition-transform">
              <MessageCircle size={20} className="text-gray-800 hover:text-blue-500 transition-colors" />
            </button>
            <button className="hover:scale-110 transition-transform">
              <Send size={20} className="text-gray-800 hover:text-green-500 transition-colors" />
            </button>
          </div>
          
          <button className="hover:scale-110 transition-transform">
            <Bookmark size={20} className="text-gray-800 hover:text-aqua transition-colors" />
          </button>
        </div>

        {/* Likes */}
        <div className="mb-2">
          <span className="font-semibold text-sm text-gray-900">247 likes</span>
        </div>

        {/* Caption */}
        <div className="text-sm text-gray-700 leading-relaxed">
          <span className="font-semibold text-gray-900">alexthompson</span>{' '}
          <span>Beautiful sunset at the beach today! 🌅 Nothing beats those golden hour vibes</span>
          <div className="text-gray-500 text-xs mt-1">#sunset #beach #goldenhour</div>
        </div>

        {/* Time */}
        <div className="text-xs text-gray-500 mt-2">
          2 HOURS AGO
        </div>
      </div>
    </motion.div>
  );
};

export default InstagramWidget;
