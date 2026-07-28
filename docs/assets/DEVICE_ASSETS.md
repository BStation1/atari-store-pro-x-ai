# Device Assets Documentation & Licensing

## Asset Sources & Rights
All local device vector assets located in `public/assets/devices/` are custom original SVG illustrations crafted 100% from scratch specifically for the **Atari Store Pro X AI** project workspace.

- **Creation & Ownership**: Created original vector graphic paths from scratch inside this project repository.
- **Logos & Trademarks**: No manufacturer logos, brand icons, or proprietary corporate graphics were copied or embedded into the vector files. They are stylized geometric silhouettes designed purely for UI recognition.
- **Copyright Holder**: Atari Store Pro X AI Project Workspace.
- **License**: Apache License, Version 2.0 (Apache-2.0).
- **Storage Path**: `/public/assets/devices/`
- **Format**: Scalable Vector Graphics (SVG), fully optimized, resolution-independent.
- **Remote Dependencies**: None (100% locally served, offline-first).

## Registered Local Assets Map

| Canonical Model ID | Display Name (Ar) | Local Asset Path | Fallback Mode |
| :--- | :--- | :--- | :--- |
| `ps5_fat` | بلاستيشن 5 | `/assets/devices/ps5.svg` | SVG Asset |
| `ps5_slim` | بلاستيشن 5 سليم | `/assets/devices/ps5.svg` | SVG Asset |
| `ps5_digital` | بلاستيشن 5 ديجيتال | `/assets/devices/ps5.svg` | SVG Asset |
| `ps5_pro` | بلاستيشن 5 برو | `/assets/devices/ps5.svg` | SVG Asset |
| `ps4_fat` | بلاستيشن 4 | `/assets/devices/ps4.svg` | SVG Asset |
| `ps4_slim` | بلاستيشن 4 سليم | `/assets/devices/ps4.svg` | SVG Asset |
| `ps4_pro` | بلاستيشن 4 برو | `/assets/devices/ps4.svg` | SVG Asset |
| `xbox_series_x` | إكس بوكس سيريس إكس | `/assets/devices/xbox_series_x.svg` | SVG Asset |
| `xbox_series_s` | إكس بوكس سيريس إس | `/assets/devices/xbox_series_s.svg` | SVG Asset |
| `xbox_one` | إكس بوكس ون | `/assets/devices/xbox_series_x.svg` | SVG Asset |
| `nintendo_switch` | نينتندو سويتش | `/assets/devices/nintendo_switch.svg` | SVG Asset |
| `nintendo_switch_oled` | نينتندو سويتش OLED | `/assets/devices/nintendo_switch.svg` | SVG Asset |
| `steam_deck` | ستيم ديك | `/assets/devices/steam_deck.svg` | SVG Asset |
| `controller_ps5` | يد تحكم بلاستيشن 5 | `/assets/devices/controller_ps5.svg` | SVG Asset |
| `controller_ps4` | يد تحكم بلاستيشن 4 | `/assets/devices/controller_ps5.svg` | SVG Asset |
| `controller_xbox` | يد تحكم إكس بوكس | `/assets/devices/controller_ps5.svg` | SVG Asset |
| `unknown` | جهاز غير محدد | None | Safe Generic Category Silhouette Icon |

## Unmapped & Fallback Models
Any unlisted device types or custom accessories utilize category-based vector fallback icons (`Gamepad2`, `Tv`, `Cpu`, `Monitor`) via `DeviceThumbnail.tsx` to prevent broken image states.
