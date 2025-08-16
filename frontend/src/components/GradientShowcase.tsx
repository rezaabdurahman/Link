import React from 'react';
import { Star, Heart, Send, Plus, Camera, MapPin } from 'lucide-react';

interface GradientShowcaseProps {
  className?: string;
}

const GradientShowcase: React.FC<GradientShowcaseProps> = ({ className = '' }) => {
  return (
    <div className={`p-6 space-y-8 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-gradient-aqua-copper text-3xl font-bold mb-2">
          🌈 Gradient System Showcase
        </h1>
        <p className="text-secondary">
          Instagram-inspired aqua-copper gradients for the Link app
        </p>
      </div>

      {/* Gradient Buttons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">Gradient Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <button className="gradient-btn-sm hover-gradient-glow">
            <Star className="w-4 h-4 mr-2" />
            Small
          </button>
          <button className="gradient-btn hover-gradient-glow">
            <Heart className="w-5 h-5 mr-2" />
            Standard
          </button>
          <button className="gradient-btn-lg hover-gradient-glow">
            <Send className="w-6 h-6 mr-2" />
            Large
          </button>
        </div>
      </div>

      {/* Avatar Rings */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">Instagram-Style Avatar Rings</h2>
        <div className="flex items-center gap-6">
          <div className="avatar-ring avatar-ring-sm">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&crop=face"
              alt="Small Avatar"
              className="w-10 h-10 object-cover"
            />
          </div>
          <div className="avatar-ring">
            <img
              src="https://images.unsplash.com/photo-1494790108755-2616b612b2e4?w=48&h=48&fit=crop&crop=face"
              alt="Standard Avatar"
              className="w-12 h-12 object-cover"
            />
          </div>
          <div className="avatar-ring avatar-ring-lg">
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face"
              alt="Large Avatar"
              className="w-16 h-16 object-cover"
            />
          </div>
        </div>
        <p className="text-sm text-text-muted">
          ✨ Rotating conic gradient rings that pause on hover
        </p>
      </div>

      {/* Gradient Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">Gradient Border Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="gradient-card-sm hover-gradient-glow">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-aqua" />
              <h3 className="font-semibold">Small Card</h3>
            </div>
            <p className="text-sm text-secondary">
              Compact card with gradient border effect.
            </p>
          </div>
          
          <div className="gradient-card hover-gradient-glow">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-aqua" />
              <h3 className="font-semibold text-lg">Standard Card</h3>
            </div>
            <p className="text-secondary mb-3">
              This card showcases our signature gradient border with Instagram-inspired styling.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-aqua rounded-full"></div>
              <span className="text-xs text-aqua font-medium">Active Feature</span>
            </div>
          </div>
        </div>
      </div>

      {/* Background Gradients */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">Background Gradients</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-aqua-copper p-4 rounded-card text-white text-center">
            <Plus className="w-8 h-8 mx-auto mb-2" />
            <h3 className="font-bold">Aqua-Copper</h3>
            <p className="text-xs opacity-90">Primary brand gradient</p>
          </div>
          
          <div className="bg-gradient-aqua-rose p-4 rounded-card text-white text-center">
            <Heart className="w-8 h-8 mx-auto mb-2" />
            <h3 className="font-bold">Aqua-Rose</h3>
            <p className="text-xs opacity-90">Alternative gradient</p>
          </div>
          
          <div className="bg-gradient-aqua-purple p-4 rounded-card text-white text-center">
            <Star className="w-8 h-8 mx-auto mb-2" />
            <h3 className="font-bold">Aqua-Purple</h3>
            <p className="text-xs opacity-90">Creative gradient</p>
          </div>
        </div>
      </div>

      {/* Text Gradients */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">Text Gradients</h2>
        <div className="space-y-2">
          <h3 className="text-gradient-aqua-copper text-2xl font-bold">
            Welcome to Link
          </h3>
          <h4 className="text-gradient-aqua-rose text-lg font-semibold">
            Connect with amazing people around you
          </h4>
          <p className="text-secondary">
            Use gradient text sparingly for maximum impact and readability.
          </p>
        </div>
      </div>

      {/* Conic Gradient Showcase */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">Conic Gradients</h2>
        <div className="flex items-center gap-4">
          <div className="bg-conic-aqua-copper w-16 h-16 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">NEW</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Special Elements</h3>
            <p className="text-sm text-secondary">
              Conic gradients perfect for badges, indicators, and special highlights.
            </p>
          </div>
        </div>
      </div>

      {/* Usage Note */}
      <div className="border-gradient-aqua-copper-thin rounded-card p-4 bg-surface-card">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-gradient-aqua-copper rounded-full"></div>
          Design Guidelines
        </h3>
        <ul className="text-sm text-secondary space-y-1">
          <li>• Use gradients purposefully - not on every element</li>
          <li>• Maintain accessibility with proper contrast ratios</li>
          <li>• Prefer border gradients for subtle elegance</li>
          <li>• Use fill gradients for primary actions and emphasis</li>
          <li>• Test gradient visibility across different devices</li>
        </ul>
      </div>
    </div>
  );
};

export default GradientShowcase;
