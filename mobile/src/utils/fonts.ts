import {
  useFonts as useDevanagariFonts,
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import {
  useFonts as useGujaratiFonts,
  NotoSansGujarati_400Regular,
  NotoSansGujarati_500Medium,
  NotoSansGujarati_600SemiBold,
  NotoSansGujarati_700Bold,
} from '@expo-google-fonts/noto-sans-gujarati';

import { Language } from '../types';

export type ScriptFontWeight = '400' | '500' | '600' | '700';

const HI_FONTS: Record<ScriptFontWeight, string> = {
  '400': 'NotoSansDevanagari_400Regular',
  '500': 'NotoSansDevanagari_500Medium',
  '600': 'NotoSansDevanagari_600SemiBold',
  '700': 'NotoSansDevanagari_700Bold',
};

const GU_FONTS: Record<ScriptFontWeight, string> = {
  '400': 'NotoSansGujarati_400Regular',
  '500': 'NotoSansGujarati_500Medium',
  '600': 'NotoSansGujarati_600SemiBold',
  '700': 'NotoSansGujarati_700Bold',
};

/** Loads the bundled Devanagari + Gujarati weights used by the app. Call
 * once at the app root; Text elements reference the font family names by
 * string via `scriptFontFamily` once this resolves `true`. */
export function useScriptFonts(): boolean {
  const [devanagariLoaded] = useDevanagariFonts({
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });
  const [gujaratiLoaded] = useGujaratiFonts({
    NotoSansGujarati_400Regular,
    NotoSansGujarati_500Medium,
    NotoSansGujarati_600SemiBold,
    NotoSansGujarati_700Bold,
  });
  return devanagariLoaded && gujaratiLoaded;
}

/** Font family for UI text in the given content `language` — hi/gu render
 * from the bundled Noto Sans fonts (consistent across OEMs/OS versions)
 * rather than whatever system font happens to be installed. English is
 * left on the platform default (undefined). */
export function scriptFontFamily(language: Language, weight: ScriptFontWeight = '400'): string | undefined {
  if (language === 'hi') return HI_FONTS[weight];
  if (language === 'gu') return GU_FONTS[weight];
  return undefined;
}

/** Font family for rendering original-language scripture verses
 * (Devanagari/Ardhamāgadhī script) — independent of the UI's selected
 * content language, since the source verse's script doesn't change when
 * the reader switches their reading language. */
export function verseScriptFontFamily(weight: ScriptFontWeight = '400'): string {
  return HI_FONTS[weight];
}
