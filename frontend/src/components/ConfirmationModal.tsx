import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  loading?: boolean;
  error?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-red-600 hover:bg-red-700 text-white",
  loading = false,
  error
}): JSX.Element | null => {
  if (!isOpen) return null;

  const handleModalKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleConfirm = (): void => {
    if (!loading) {
      onConfirm();
    }
  };

  const handleCancel = (): void => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={handleCancel}
      onKeyDown={handleModalKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div 
        className="modal-content max-w-sm mx-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-text-secondary text-base leading-relaxed mb-6">
            {message}
          </p>
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 ${confirmButtonClass}`}
            >
              {loading ? 'Processing...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
