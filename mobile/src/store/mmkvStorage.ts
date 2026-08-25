import { createMMKV } from 'react-native-mmkv';

// Single shared MMKV instance for all local app persistence (theme,
// language preference, ...). Synchronous reads/writes — no async ceremony
// needed, unlike the AsyncStorage it replaced.
export const storage = createMMKV({ id: 'jinvani-app-storage' });
