import React, { useState, useRef } from 'react';
import { Camera, Mic, MapPin, Paperclip, X, Image, Send } from 'lucide-react';

interface MediaAttachment {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
}

interface FileAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
}

interface VoiceNote {
  id: string;
  duration: number;
  url: string;
}

interface LocationAttachment {
  id: string;
  name: string;
  coordinates?: { lat: number; lng: number };
}

const CheckinPage: React.FC = (): JSX.Element => {
  const [searchText, setSearchText] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(null);
  const [locationAttachment, setLocationAttachment] = useState<LocationAttachment | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const id = `media_${Date.now()}_${index}`;
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      
      setMediaAttachments(prev => [...prev, {
        id,
        type,
        url,
        name: file.name
      }]);
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const id = `file_${Date.now()}_${index}`;
      const size = (file.size / 1024).toFixed(1) + ' KB';
      
      setFileAttachments(prev => [...prev, {
        id,
        name: file.name,
        size,
        type: file.type
      }]);
    });
  };

  const handleAddLocation = () => {
    // Simulate location detection
    setLocationAttachment({
      id: 'location_' + Date.now(),
      name: 'Current Location',
      coordinates: { lat: 37.7749, lng: -122.4194 }
    });
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    
    // Simulate recording
    const interval = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= 60) {
          handleStopRecording();
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setVoiceNote({
      id: 'voice_' + Date.now(),
      duration: recordingDuration,
      url: '#'
    });
  };

  const handleRemoveMedia = (id: string) => {
    setMediaAttachments(prev => prev.filter(item => item.id !== id));
  };

  const handleRemoveFile = (id: string) => {
    setFileAttachments(prev => prev.filter(item => item.id !== id));
  };

  const handleRemoveVoiceNote = () => {
    setVoiceNote(null);
  };

  const handleRemoveLocation = () => {
    setLocationAttachment(null);
  };

  const handlePost = () => {
    // Handle posting logic here
    console.log('Posting check-in:', {
      text: searchText,
      media: mediaAttachments,
      files: fileAttachments,
      voiceNote,
      location: locationAttachment
    });
    
    // Reset form
    setSearchText('');
    setMediaAttachments([]);
    setFileAttachments([]);
    setVoiceNote(null);
    setLocationAttachment(null);
    setIsSearchFocused(false);
  };

  const hasAttachments = mediaAttachments.length > 0 || fileAttachments.length > 0 || voiceNote || locationAttachment;

  return (
    <div className="ios-safe-area" style={{ padding: '0 16px' }}>
      {/* Header */}
      <div style={{ 
        paddingTop: '16px',
        marginBottom: '16px'
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>
          Check-in
        </h1>
        <p className="text-secondary" style={{ fontSize: '14px' }}>
          Share what's on your mind
        </p>
      </div>

      {/* Main Content Card */}
      <div className="ios-card" style={{ padding: '16px', marginBottom: '16px' }}>
        {/* Search/Text Input Area */}
        <div 
          className={`relative transition-all duration-200 mb-3`}
          style={{
            border: isSearchFocused ? '2px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <div style={{ padding: '12px', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <textarea
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="What's happening?"
              style={{
                flex: '1',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#000000',
                fontSize: '16px',
                resize: 'none',
                minHeight: '24px',
                maxHeight: '120px',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
              }}
              rows={1}
            />
            <button
              onClick={handlePost}
              className={`p-2 rounded-full transition-all duration-200 hover:scale-105 flex items-center justify-center flex-shrink-0 ${
                (searchText.trim() || hasAttachments) 
                  ? 'bg-aqua hover:bg-aqua-dark text-white' 
                  : 'bg-gray-300 hover:bg-gray-400 text-gray-600 cursor-not-allowed'
              }`}
              style={{ width: '32px', height: '32px' }}
              disabled={!(searchText.trim() || hasAttachments)}
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Attachment Options (always visible and scrollable) */}
        <div style={{ marginBottom: '16px' }}>
          {/* Attachment Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: hasAttachments ? '12px' : '0',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            <style>{`
              div::-webkit-scrollbar { display: none; }
            `}</style>
            <button
              onClick={() => mediaInputRef.current?.click()}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-aqua/20 hover:bg-aqua/30 text-aqua rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
            >
              <Camera size={14} />
              Media
            </button>

            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap ${
                isRecording 
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                  : 'bg-aqua/20 hover:bg-aqua/30 text-aqua'
              }`}
            >
              <Mic size={14} />
              {isRecording ? `Recording ${recordingDuration}s` : 'Voice'}
            </button>

            <button
              onClick={handleAddLocation}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-aqua/20 hover:bg-aqua/30 text-aqua rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
            >
              <MapPin size={14} />
              Location
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-aqua/20 hover:bg-aqua/30 text-aqua rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 whitespace-nowrap"
            >
              <Paperclip size={14} />
              Files
            </button>
          </div>

            {/* Media Attachments Preview */}
            {mediaAttachments.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {mediaAttachments.map((media) => (
                    <div key={media.id} className="relative">
                      <img
                        src={media.url}
                        alt={media.name}
                        style={{
                          width: '70px',
                          height: '70px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}
                      />
                      <button
                        onClick={() => handleRemoveMedia(media.id)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                      >
                        <X size={10} color="white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Attachments Preview */}
            {fileAttachments.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {fileAttachments.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      marginBottom: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Paperclip size={14} color="#06b6d4" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500' }}>{file.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{file.size}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice Note Preview */}
            {voiceNote && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  background: 'rgba(6, 182, 212, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  marginBottom: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mic size={14} color="#06b6d4" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#06b6d4' }}>Voice Note</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{voiceNote.duration}s</div>
                  </div>
                </div>
                <button
                  onClick={handleRemoveVoiceNote}
                  className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {/* Location Preview */}
            {locationAttachment && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  background: 'rgba(6, 182, 212, 0.1)',
                  borderRadius: '6px',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  marginBottom: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={14} color="#06b6d4" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#06b6d4' }}>{locationAttachment.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Location attached</div>
                  </div>
                </div>
                <button
                  onClick={handleRemoveLocation}
                  className="w-5 h-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Recent Check-ins Section */}
      <div style={{ marginBottom: '20px', paddingBottom: '4px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '6px' }}>
          Recent Check-ins
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px', lineHeight: '1.4' }}>
          This is a private space - share any of your thoughts! We'll curate/summarize updates to your friends.
        </p>
        
        <div style={{ 
          textAlign: 'center', 
          padding: '32px 16px',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <Image size={40} style={{ marginBottom: '12px', opacity: 0.5, margin: '0 auto 12px auto' }} />
          <p style={{ fontSize: '14px' }}>Your check-ins will appear here</p>
          <p style={{ fontSize: '12px', marginTop: '6px' }}>Share your moments with the community</p>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleMediaUpload}
      />
    </div>
  );
};

export default CheckinPage;
