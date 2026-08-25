import { Compass, Sparkles, BookOpen, HeartHandshake, Flame, Feather, LucideIcon } from 'lucide-react-native';
import { Language } from '../types';

export interface Topic {
  id: string;
  /** Canonical filter key sent to the backend (topic_tag) — never translated. */
  tag: string;
  name: Record<Language, string>;
  description: Record<Language, string>;
  icon: LucideIcon;
}

export const TOPICS: Topic[] = [
  {
    id: '1',
    tag: 'Philosophy',
    name: { en: 'Philosophy', hi: 'दर्शनशास्त्र', gu: 'તત્વજ્ઞાન' },
    description: {
      en: 'Foundations of reality, soul and metaphysics.',
      hi: 'वास्तविकता, आत्मा और तत्वमीमांसा की नींव।',
      gu: 'વાસ્તવિકતા, આત્મા અને તત્વમીમાંસાનો પાયો.',
    },
    icon: Compass,
  },
  {
    id: '2',
    tag: 'Ethics',
    name: { en: 'Ethics & Ahimsa', hi: 'नैतिकता और अहिंसा', gu: 'નીતિશાસ્ત્ર અને અહિંસા' },
    description: {
      en: 'Universal non-violence and compassionate living.',
      hi: 'सार्वभौमिक अहिंसा और करुणामय जीवन।',
      gu: 'સાર્વત્રિક અહિંસા અને કરુણાપૂર્ણ જીવન.',
    },
    icon: HeartHandshake,
  },
  {
    id: '3',
    tag: 'History',
    name: { en: 'History & Lineage', hi: 'इतिहास और परंपरा', gu: 'ઇતિહાસ અને પરંપરા' },
    description: {
      en: 'Lives of the 24 Tirthankaras and acharyas.',
      hi: '24 तीर्थंकरों और आचार्यों का जीवन।',
      gu: '24 તીર્થંકરો અને આચાર્યોનું જીવન.',
    },
    icon: BookOpen,
  },
  {
    id: '4',
    tag: 'Liberation',
    name: { en: 'Liberation', hi: 'मोक्ष', gu: 'મોક્ષ' },
    description: {
      en: 'The triple jewel path to permanent freedom.',
      hi: 'स्थायी मुक्ति का त्रिरत्न मार्ग।',
      gu: 'કાયમી મુક્તિનો ત્રિરત્ન માર્ગ.',
    },
    icon: Sparkles,
  },
  {
    id: '5',
    tag: 'Karma',
    name: { en: 'Karma Theory', hi: 'कर्म सिद्धांत', gu: 'કર્મ સિદ્ધાંત' },
    description: {
      en: 'Mechanics of karmic bondage and shedding.',
      hi: 'कर्म बंधन और उसके क्षय की प्रक्रिया।',
      gu: 'કર્મ બંધન અને તેના ક્ષયની પ્રક્રિયા.',
    },
    icon: Flame,
  },
  {
    id: '6',
    tag: 'Mindfulness',
    name: { en: 'Mindfulness', hi: 'सजगता', gu: 'જાગૃતિ' },
    description: {
      en: 'Equanimity, introspection and contemplation.',
      hi: 'समभाव, आत्मनिरीक्षण और चिंतन।',
      gu: 'સમભાવ, આત્મનિરીક્ષણ અને ચિંતન.',
    },
    icon: Feather,
  },
];
