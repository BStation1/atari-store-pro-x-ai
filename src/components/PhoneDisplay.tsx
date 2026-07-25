import React from 'react';
import { formatPhoneDisplay } from '../utils/phone';

interface PhoneDisplayProps {
  phone: string | null | undefined;
  className?: string;
  fallback?: string;
  style?: React.CSSProperties;
}

export const PhoneDisplay: React.FC<PhoneDisplayProps> = ({
  phone,
  className = '',
  fallback = 'غير مسجل',
  style = {}
}) => {
  if (!phone || !phone.trim()) {
    return <span className={className}>{fallback}</span>;
  }

  const formatted = formatPhoneDisplay(phone);

  return (
    <span
      dir="ltr"
      className={`inline-block text-left whitespace-nowrap ${className}`}
      style={{ direction: 'ltr', unicodeBidi: 'isolate', whiteSpace: 'nowrap', ...style }}
    >
      {formatted}
    </span>
  );
};

export default PhoneDisplay;
