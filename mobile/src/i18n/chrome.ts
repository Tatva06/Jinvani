import { Language } from '../types';

export interface ChromeStrings {
  settings: {
    title: string;
    appearance: string;
    darkMode: string;
    currentlyDark: string;
    currentlyLight: string;
    defaultLanguage: string;
    notifications: string;
    dailyReminder: string;
    dailyReminderSubtitle: string;
    about: string;
    appTagline: string;
  };
  topics: {
    title: string;
    subtitle: string;
    allTopics: string;
    categories: string;
  };
  tabs: {
    search: string;
    feed: string;
    library: string;
    profile: string;
  };
  library: {
    title: string;
    subtitle: string;
    cardsLabel: string;
    chaptersLabel: string;
    chaptersTitle: string;
    startReading: string;
  };
  feed: {
    keyTakeaway: string;
    originalSource: string;
  };
  search: {
    placeholder: string;
    noResults: string;
    searching: string;
  };
  profile: {
    title: string;
    saved: string;
    savedEmpty: string;
    personalizeFeed: string;
    defaultTopicLabel: string;
    shareApp: string;
    shareMessage: string;
    feedback: string;
    loginPrompt: string;
    loginButton: string;
    logoutButton: string;
    loggedInAs: string;
    saveRequiresLogin: string;
  };
  auth: {
    signInTitle: string;
    signUpTitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    signInButton: string;
    signUpButton: string;
    switchToSignUp: string;
    switchToSignIn: string;
    loading: string;
  };
}

export const CHROME: Record<Language, ChromeStrings> = {
  en: {
    settings: {
      title: 'Settings',
      appearance: 'Appearance',
      darkMode: 'Dark Mode',
      currentlyDark: 'Currently dark',
      currentlyLight: 'Currently light',
      defaultLanguage: 'Default Language',
      notifications: 'Notifications',
      dailyReminder: 'Daily Reminder',
      dailyReminderSubtitle: 'Get a card every morning',
      about: 'About',
      appTagline: 'Jain scripture in your pocket',
    },
    topics: {
      title: 'Explore Topics',
      subtitle: 'Filter scripture cards by subject.',
      allTopics: 'All Topics',
      categories: 'Categories',
    },
    tabs: { search: 'Search', feed: 'Feed', library: 'Library', profile: 'Profile' },
    library: {
      title: 'Library',
      subtitle: 'Browse full books in reading order.',
      cardsLabel: 'cards',
      chaptersLabel: 'chapters',
      chaptersTitle: 'Chapters',
      startReading: 'Start Reading',
    },
    feed: {
      keyTakeaway: 'Key Takeaway',
      originalSource: 'Original Source',
    },
    search: {
      placeholder: 'Search scripture cards...',
      noResults: 'No cards found.',
      searching: 'Searching...',
    },
    profile: {
      title: 'Profile',
      saved: 'Saved',
      savedEmpty: 'No saved cards yet.',
      personalizeFeed: 'Personalize Feed',
      defaultTopicLabel: 'Default topic on open',
      shareApp: 'Share App',
      shareMessage: 'Check out Jinvani — Jain scripture in your pocket.',
      feedback: 'Send Feedback',
      loginPrompt: 'Log in to save cards across your devices.',
      loginButton: 'Log In / Sign Up',
      logoutButton: 'Log Out',
      loggedInAs: 'Logged in as',
      saveRequiresLogin: 'Log in to save cards.',
    },
    auth: {
      signInTitle: 'Log In',
      signUpTitle: 'Sign Up',
      emailLabel: 'Email',
      emailPlaceholder: 'you@example.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'At least 6 characters',
      signInButton: 'Log In',
      signUpButton: 'Create Account',
      switchToSignUp: "Don't have an account? Sign up",
      switchToSignIn: 'Already have an account? Log in',
      loading: 'Please wait...',
    },
  },
  hi: {
    settings: {
      title: 'सेटिंग्स',
      appearance: 'रूप-रंग',
      darkMode: 'डार्क मोड',
      currentlyDark: 'वर्तमान में डार्क',
      currentlyLight: 'वर्तमान में लाइट',
      defaultLanguage: 'डिफ़ॉल्ट भाषा',
      notifications: 'सूचनाएं',
      dailyReminder: 'दैनिक अनुस्मारक',
      dailyReminderSubtitle: 'हर सुबह एक कार्ड पाएं',
      about: 'परिचय',
      appTagline: 'आपकी जेब में जैन शास्त्र',
    },
    topics: {
      title: 'विषय खोजें',
      subtitle: 'विषय के अनुसार कार्ड फ़िल्टर करें।',
      allTopics: 'सभी विषय',
      categories: 'श्रेणियाँ',
    },
    tabs: { search: 'खोजें', feed: 'फ़ीड', library: 'लाइब्रेरी', profile: 'प्रोफ़ाइल' },
    library: {
      title: 'लाइब्रेरी',
      subtitle: 'पूरी किताबें पढ़ने के क्रम में देखें।',
      cardsLabel: 'कार्ड',
      chaptersLabel: 'अध्याय',
      chaptersTitle: 'अध्याय',
      startReading: 'पढ़ना शुरू करें',
    },
    feed: {
      keyTakeaway: 'मुख्य सीख',
      originalSource: 'मूल स्रोत',
    },
    search: {
      placeholder: 'शास्त्र कार्ड खोजें...',
      noResults: 'कोई कार्ड नहीं मिला।',
      searching: 'खोजा जा रहा है...',
    },
    profile: {
      title: 'प्रोफ़ाइल',
      saved: 'सहेजे गए',
      savedEmpty: 'अभी तक कोई कार्ड सहेजा नहीं गया।',
      personalizeFeed: 'फ़ीड को अनुकूलित करें',
      defaultTopicLabel: 'खोलने पर डिफ़ॉल्ट विषय',
      shareApp: 'ऐप साझा करें',
      shareMessage: 'जिनवाणी देखें — आपकी जेब में जैन शास्त्र।',
      feedback: 'प्रतिक्रिया भेजें',
      loginPrompt: 'अपने सभी डिवाइस पर कार्ड सहेजने के लिए लॉग इन करें।',
      loginButton: 'लॉग इन / साइन अप',
      logoutButton: 'लॉग आउट',
      loggedInAs: 'इस रूप में लॉग इन:',
      saveRequiresLogin: 'कार्ड सहेजने के लिए लॉग इन करें।',
    },
    auth: {
      signInTitle: 'लॉग इन करें',
      signUpTitle: 'साइन अप करें',
      emailLabel: 'ईमेल',
      emailPlaceholder: 'you@example.com',
      passwordLabel: 'पासवर्ड',
      passwordPlaceholder: 'कम से कम 6 अक्षर',
      signInButton: 'लॉग इन करें',
      signUpButton: 'खाता बनाएं',
      switchToSignUp: 'खाता नहीं है? साइन अप करें',
      switchToSignIn: 'पहले से खाता है? लॉग इन करें',
      loading: 'कृपया प्रतीक्षा करें...',
    },
  },
  gu: {
    settings: {
      title: 'સેટિંગ્સ',
      appearance: 'દેખાવ',
      darkMode: 'ડાર્ક મોડ',
      currentlyDark: 'હાલમાં ડાર્ક',
      currentlyLight: 'હાલમાં લાઇટ',
      defaultLanguage: 'મૂળભૂત ભાષા',
      notifications: 'સૂચનાઓ',
      dailyReminder: 'દૈનિક રિમાઇન્ડર',
      dailyReminderSubtitle: 'દરરોજ સવારે એક કાર્ડ મેળવો',
      about: 'વિશે',
      appTagline: 'તમારા ખિસ્સામાં જૈન શાસ્ત્ર',
    },
    topics: {
      title: 'વિષયો શોધો',
      subtitle: 'વિષય પ્રમાણે કાર્ડ ફિલ્ટર કરો.',
      allTopics: 'બધા વિષયો',
      categories: 'શ્રેણીઓ',
    },
    tabs: { search: 'શોધો', feed: 'ફીડ', library: 'લાઇબ્રેરી', profile: 'પ્રોફાઇલ' },
    library: {
      title: 'લાઇબ્રેરી',
      subtitle: 'સંપૂર્ણ પુસ્તકો વાંચન ક્રમમાં જુઓ.',
      cardsLabel: 'કાર્ડ',
      chaptersLabel: 'પ્રકરણો',
      chaptersTitle: 'પ્રકરણો',
      startReading: 'વાંચન શરૂ કરો',
    },
    feed: {
      keyTakeaway: 'મુખ્ય શીખ',
      originalSource: 'મૂળ સ્ત્રોત',
    },
    search: {
      placeholder: 'શાસ્ત્ર કાર્ડ શોધો...',
      noResults: 'કોઈ કાર્ડ મળ્યું નથી.',
      searching: 'શોધાઈ રહ્યું છે...',
    },
    profile: {
      title: 'પ્રોફાઇલ',
      saved: 'સાચવેલા',
      savedEmpty: 'હજુ સુધી કોઈ કાર્ડ સાચવ્યું નથી.',
      personalizeFeed: 'ફીડને વ્યક્તિગત બનાવો',
      defaultTopicLabel: 'ખોલવા પર મૂળભૂત વિષય',
      shareApp: 'એપ શેર કરો',
      shareMessage: 'જિનવાણી જુઓ — તમારા ખિસ્સામાં જૈન શાસ્ત્ર.',
      feedback: 'પ્રતિભાવ મોકલો',
      loginPrompt: 'તમારા બધા ડિવાઇસ પર કાર્ડ સાચવવા માટે લૉગ ઇન કરો.',
      loginButton: 'લૉગ ઇન / સાઇન અપ',
      logoutButton: 'લૉગ આઉટ',
      loggedInAs: 'આ રીતે લૉગ ઇન:',
      saveRequiresLogin: 'કાર્ડ સાચવવા માટે લૉગ ઇન કરો.',
    },
    auth: {
      signInTitle: 'લૉગ ઇન કરો',
      signUpTitle: 'સાઇન અપ કરો',
      emailLabel: 'ઈમેલ',
      emailPlaceholder: 'you@example.com',
      passwordLabel: 'પાસવર્ડ',
      passwordPlaceholder: 'ઓછામાં ઓછા 6 અક્ષરો',
      signInButton: 'લૉગ ઇન કરો',
      signUpButton: 'ખાતું બનાવો',
      switchToSignUp: 'ખાતું નથી? સાઇન અપ કરો',
      switchToSignIn: 'પહેલેથી ખાતું છે? લૉગ ઇન કરો',
      loading: 'કૃપા કરી રાહ જુઓ...',
    },
  },
};
