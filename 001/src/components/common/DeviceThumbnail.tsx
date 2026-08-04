/**
 * DeviceThumbnail Component (Phase 3UI.1 - Device Asset Library & Fallback System)
 * Mandatory Fallback Priority:
 *   1. Actual Repair Order Device Image (src)
 *   2. Local Model Image from Device Registry
 *   3. Category-Appropriate Silhouette / Vector Placeholder
 *   4. Safe Generic Fallback
 *
 * Supports lazy loading, error fallback without infinite loop, desktop hover preview, and touch device accessibility.
 * @license Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Gamepad2, Tv, Cpu, Monitor, Box } from 'lucide-react';
import { resolveCanonicalDeviceModel, getDeviceLocalAssetPath } from '../../lib/devices';

export interface DeviceThumbnailProps {
  src?: string;
  modelName?: string;
  deviceType?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  rounded?: boolean | string;
  previewOnHover?: boolean;
  className?: string;
}

export const DeviceThumbnail: React.FC<DeviceThumbnailProps> = ({
  src,
  modelName,
  deviceType,
  alt = 'صورة الجهاز',
  size = 'md',
  rounded = true,
  previewOnHover = false,
  className = ''
}) => {
  const [hasActualError, setHasActualError] = useState(false);
  const [hasModelError, setHasModelError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Determine registry local asset path if available
  const registryLocalAssetPath = useMemo(() => {
    return getDeviceLocalAssetPath(modelName) || getDeviceLocalAssetPath(deviceType);
  }, [modelName, deviceType]);

  // Determine canonical model definition
  const canonicalModel = useMemo(() => {
    return resolveCanonicalDeviceModel(modelName || deviceType);
  }, [modelName, deviceType]);

  // Effective image source based on priority flow
  const effectiveSrc = useMemo(() => {
    if (src && !hasActualError) {
      return src;
    }
    if (registryLocalAssetPath && !hasModelError) {
      return registryLocalAssetPath;
    }
    return null;
  }, [src, hasActualError, registryLocalAssetPath, hasModelError]);

  const handleError = () => {
    if (src && !hasActualError) {
      setHasActualError(true);
    } else if (registryLocalAssetPath && !hasModelError) {
      setHasModelError(true);
    }
  };

  const sizeClasses = {
    xs: 'w-8 h-8 text-[10px]',
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-base'
  }[size];

  const iconSizes = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10'
  }[size];

  const roundedClass = typeof rounded === 'string'
    ? rounded
    : rounded
      ? size === 'xs' ? 'rounded-md' : size === 'lg' ? 'rounded-2xl' : 'rounded-xl'
      : 'rounded-none';

  const getFallbackIcon = () => {
    switch (canonicalModel.fallbackIconType) {
      case 'gamepad':
        return <Gamepad2 className={`${iconSizes} text-indigo-400`} />;
      case 'box':
        return <Box className={`${iconSizes} text-emerald-400`} />;
      case 'tv':
        return <Tv className={`${iconSizes} text-cyan-400`} />;
      case 'cpu':
      default:
        return <Cpu className={`${iconSizes} text-slate-400`} />;
    }
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`relative overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center ${sizeClasses} ${roundedClass}`}
      >
        {effectiveSrc ? (
          <img
            src={effectiveSrc}
            alt={alt}
            loading="lazy"
            onError={handleError}
            className="w-full h-full object-cover transition-opacity duration-200"
          />
        ) : (
          <div
            aria-label={alt}
            role="img"
            className="w-full h-full flex items-center justify-center p-1 bg-slate-900/90 text-slate-400"
          >
            {getFallbackIcon()}
          </div>
        )}
      </div>

      {/* Desktop-only Hover Preview Tooltip/Modal */}
      {previewOnHover && isHovered && effectiveSrc && (
        <div className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 p-1.5 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <img
            src={effectiveSrc}
            alt={alt}
            className="w-36 h-36 object-cover rounded-lg"
          />
          <div className="mt-1 px-1 text-[10px] font-bold text-slate-200 text-center truncate max-w-[140px]">
            {canonicalModel.displayNameAr || modelName}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceThumbnail;
