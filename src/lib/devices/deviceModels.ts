/**
 * Device Model Registry (Phase 3UI.1 - Device Asset Library)
 * Central definitions for canonical device models, Arabic/English names, manufacturers, aliases, and local assets.
 * @license Apache-2.0
 */

import { DeviceModelDefinition } from './deviceTypes';

export const DEVICE_MODEL_REGISTRY: DeviceModelDefinition[] = [
  {
    canonicalId: 'ps5_fat',
    displayNameAr: 'بلاستيشن 5 الأصلي',
    displayNameEn: 'PlayStation 5 Fat',
    manufacturer: 'Sony',
    aliases: [
      'ps5', 'ps 5', 'playstation 5', 'playstation5', 'ps5 fat', 'بلايستيشن 5', 'بلاستيشن 5', 'بليستيشن 5'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/ps5.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'ps5_slim',
    displayNameAr: 'بلاستيشن 5 سليم',
    displayNameEn: 'PlayStation 5 Slim',
    manufacturer: 'Sony',
    aliases: [
      'ps5 slim', 'ps 5 slim', 'playstation 5 slim', 'playstation5 slim', 'بلاستيشن 5 سليم', 'بلايستيشن 5 سليم'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/ps5.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'ps5_digital',
    displayNameAr: 'بلاستيشن 5 ديجيتال',
    displayNameEn: 'PlayStation 5 Digital',
    manufacturer: 'Sony',
    aliases: [
      'ps5 digital', 'playstation 5 digital', 'ps5 digital edition', 'بلاستيشن 5 ديجيتال'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/ps5.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'ps5_pro',
    displayNameAr: 'بلاستيشن 5 برو',
    displayNameEn: 'PlayStation 5 Pro',
    manufacturer: 'Sony',
    aliases: [
      'ps5 pro', 'playstation 5 pro', 'ps 5 pro', 'بلاستيشن 5 برو'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/ps5.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'ps4_fat',
    displayNameAr: 'بلاستيشن 4 الأصلي',
    displayNameEn: 'PlayStation 4 Fat',
    manufacturer: 'Sony',
    aliases: [
      'ps4', 'ps 4', 'playstation 4', 'playstation4', 'ps4 fat', 'بلاستيشن 4', 'بلايستيشن 4'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/ps4.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'ps4_slim',
    displayNameAr: 'بلاستيشن 4 سليم',
    displayNameEn: 'PlayStation 4 Slim',
    manufacturer: 'Sony',
    aliases: [
      'ps4 slim', 'playstation 4 slim', 'ps 4 slim', 'بلاستيشن 4 سليم'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/ps4.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'ps4_pro',
    displayNameAr: 'بلاستيشن 4 برو',
    displayNameEn: 'PlayStation 4 Pro',
    manufacturer: 'Sony',
    aliases: [
      'ps4 pro', 'playstation 4 pro', 'ps 4 pro', 'بلاستيشن 4 برو'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/ps4.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'xbox_series_x',
    displayNameAr: 'إكس بوكس سيريس إكس',
    displayNameEn: 'Xbox Series X',
    manufacturer: 'Microsoft',
    aliases: [
      'xbox series x', 'xsx', 'xbox seriesx', 'xbox sx', 'إكس بوكس سيريس إكس', 'اكس بوكس سيريس اكس'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/xbox_series_x.svg',
    fallbackIconType: 'box'
  },
  {
    canonicalId: 'xbox_series_s',
    displayNameAr: 'إكس بوكس سيريس إس',
    displayNameEn: 'Xbox Series S',
    manufacturer: 'Microsoft',
    aliases: [
      'xbox series s', 'xss', 'xbox seriess', 'xbox ss', 'إكس بوكس سيريس إس', 'اكس بوكس سيريس اس'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/xbox_series_s.svg',
    fallbackIconType: 'box'
  },
  {
    canonicalId: 'xbox_one',
    displayNameAr: 'إكس بوكس ون',
    displayNameEn: 'Xbox One',
    manufacturer: 'Microsoft',
    aliases: [
      'xbox one', 'xboxone', 'xbox one s', 'xbox one x', 'إكس بوكس ون', 'اكس بوكس ون'
    ],
    category: 'console',
    localAssetPath: '/assets/devices/xbox_series_x.svg',
    fallbackIconType: 'box'
  },
  {
    canonicalId: 'nintendo_switch',
    displayNameAr: 'نينتندو سويتش',
    displayNameEn: 'Nintendo Switch',
    manufacturer: 'Nintendo',
    aliases: [
      'nintendo switch', 'switch', 'switch v2', 'switch lite', 'نينتندو سويتش', 'سويتش'
    ],
    category: 'handheld',
    localAssetPath: '/assets/devices/nintendo_switch.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'nintendo_switch_oled',
    displayNameAr: 'نينتندو سويتش OLED',
    displayNameEn: 'Nintendo Switch OLED',
    manufacturer: 'Nintendo',
    aliases: [
      'nintendo switch oled', 'switch oled', 'نينتندو سويتش اوليد'
    ],
    category: 'handheld',
    localAssetPath: '/assets/devices/nintendo_switch.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'steam_deck',
    displayNameAr: 'ستيم ديك',
    displayNameEn: 'Steam Deck',
    manufacturer: 'Valve',
    aliases: [
      'steam deck', 'steamdeck', 'ستيم ديك'
    ],
    category: 'handheld',
    localAssetPath: '/assets/devices/steam_deck.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'controller_ps5',
    displayNameAr: 'ذراع تحكم بلاستيشن 5',
    displayNameEn: 'Controller PS5 (DualSense)',
    manufacturer: 'Sony',
    aliases: [
      'controller ps5', 'dualsense', 'يد ps5', 'ذراع ps5', 'يد بلاستيشن 5', 'يد تحكم ps5'
    ],
    category: 'controller',
    localAssetPath: '/assets/devices/controller_ps5.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'controller_ps4',
    displayNameAr: 'ذراع تحكم بلاستيشن 4',
    displayNameEn: 'Controller PS4 (DualShock 4)',
    manufacturer: 'Sony',
    aliases: [
      'controller ps4', 'dualshock 4', 'يد ps4', 'ذراع ps4', 'يد بلاستيشن 4', 'يد تحكم ps4'
    ],
    category: 'controller',
    localAssetPath: '/assets/devices/controller_ps5.svg',
    fallbackIconType: 'gamepad'
  },
  {
    canonicalId: 'controller_xbox',
    displayNameAr: 'ذراع تحكم إكس بوكس',
    displayNameEn: 'Xbox Controller',
    manufacturer: 'Microsoft',
    aliases: [
      'xbox controller', 'يد xbox', 'ذراع xbox', 'يد اكس بوكس', 'يد تحكم اكس بوكس'
    ],
    category: 'controller',
    localAssetPath: '/assets/devices/controller_ps5.svg',
    fallbackIconType: 'gamepad'
  }
];

export const UNKNOWN_DEVICE_MODEL: DeviceModelDefinition = {
  canonicalId: 'unknown',
  displayNameAr: 'جهاز غير معروف',
  displayNameEn: 'Other / Unknown Device',
  manufacturer: 'Generic',
  aliases: [],
  category: 'other',
  fallbackIconType: 'cpu'
};
