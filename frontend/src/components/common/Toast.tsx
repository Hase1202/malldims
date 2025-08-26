import { X, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ToastProps {
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'loading';
  duration?: number | null;
  onClose?: () => void;
  isVisible: boolean;
}

export default function Toast({ 
  title,
  message, 
  type = 'info', 
  duration = 3000,
  onClose,
  isVisible
}: ToastProps) {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsShowing(true);
      
      if (duration !== null) {
        const timer = setTimeout(() => {
          setIsShowing(false);
          if (onClose) setTimeout(onClose, 300);
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      setIsShowing(false);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible && !isShowing) return null;

  const bgColor = 'bg-white border-[#EBEAEA]'; // White background with light border
  
  // Color for the icon
  const iconColor = 'text-[#0504AA]';  // Deep blue for all states
    
  // Title color - consistent for all states
  const titleColor = 'text-[#2C2C2C]';
    
  // Color for the subtitle/message text
  const messageColor = 'text-[#6F6F6F]'; // Gray subtitle text

  return (
    <div 
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isShowing ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border-[1.5px] ${bgColor} shadow-lg max-w-md`}>
        {/* Icon */}
        <div className="flex-shrink-0">
          {type === 'success' && <CheckCircle className={`h-5 w-5 ${iconColor}`} />}
          {type === 'loading' && <div className="w-5 h-5 rounded-full border-2 mr-1 border-[#0504AA] border-t-transparent animate-spin"></div>}
        </div>
        
        {/* Content */}
        <div className="flex-1">
          <div className={`font-medium text-base ${titleColor}`}>{title}</div>
          {message && <div className={`${messageColor} text-sm mt-0.5`}>{message}</div>}
        </div>
        
        {/* Close button */}
        <button 
          onClick={() => {
            setIsShowing(false);
            if (onClose) setTimeout(onClose, 300);
          }}
          className="text-[#646464] hover:text-[#2C2C2C] ml-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 