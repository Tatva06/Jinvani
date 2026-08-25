-- Run this in Supabase SQL Editor to add 4 more cards to the existing deck
-- (deck_id matches the seeded Tattvartha Sutra deck)

INSERT INTO cards (deck_id, sequence_order, card_type, citation_reference, status, content, original_verse)
VALUES
(
  '11111111-1111-1111-1111-111111111111',
  2,
  'chunked_verse',
  'Chapter 1, Sutra 2',
  'approved',
  '{
    "en": {"title": "The Nature of the Soul", "body": "The soul is characterised by consciousness. It is neither created nor destroyed, existing eternally in varying states of purity.", "takeaway": "Your true self is eternal awareness, not the body or mind."},
    "hi": {"title": "आत्मा का स्वरूप", "body": "आत्मा का लक्षण चेतना है। यह न बनती है, न नष्ट होती है — अनंत काल से विविध अवस्थाओं में विद्यमान है।", "takeaway": "आपका वास्तविक स्वरूप शाश्वत चेतना है।"},
    "gu": {"title": "આત્માનું સ્વરૂપ", "body": "આત્માનું લક્ષણ ચેતના છે. તે ન સર્જાય છે, ન નષ્ટ થાય — અનંત કાળથી વિવિધ અવસ્થાઓમાં વિદ્યમાન છે.", "takeaway": "તમારું સાચું સ્વ શાશ્વત ચેતના છે."}
  }',
  '{"script": "Sanskrit", "text": "उपयोगो लक्षणम्"}'
),
(
  '11111111-1111-1111-1111-111111111111',
  3,
  'chunked_verse',
  'Chapter 2, Sutra 1',
  'approved',
  '{
    "en": {"title": "Five Categories of Being", "body": "All that exists falls into five categories: souls, matter, space, time, and the principles of motion and rest.", "takeaway": "Reality is structured, knowable, and navigable by the awakened mind."},
    "hi": {"title": "पाँच द्रव्य", "body": "जो कुछ भी अस्तित्व में है वह पाँच द्रव्यों में आता है: जीव, पुद्गल, आकाश, काल, और गति-स्थिति के माध्यम।", "takeaway": "वास्तविकता संरचित और बोधगम्य है।"},
    "gu": {"title": "પાંચ દ્રવ્ય", "body": "જે કંઈ અસ્તિત્વ ધરાવે છે તે પાંચ દ્રવ્યોમાં આવે છે: જીવ, પુદ્ગળ, આકાશ, કાળ, ગતિ-સ્થિતિ.", "takeaway": "સત્ય સ્વરૂપ સ્પષ્ટ અને જ્ઞેય છે."}
  }',
  '{"script": "Sanskrit", "text": "जीवाजीवास्रवबन्धसंवरनिर्जरामोक्षास्तत्त्वम्"}'
),
(
  '11111111-1111-1111-1111-111111111111',
  4,
  'chunked_verse',
  'Chapter 6, Sutra 1',
  'approved',
  '{
    "en": {"title": "Karma Flows In", "body": "Karma flows into the soul through the activities of mind, body, and speech — intensified by passion and weakened by equanimity.", "takeaway": "Every thought, word, and act shapes your karmic trajectory."},
    "hi": {"title": "कर्म का आगमन", "body": "मन, वचन और काय की क्रियाओं से कर्म आत्मा में आता है — कषाय से तीव्र और समता से मंद होता है।", "takeaway": "हर विचार, वचन और क्रिया आपके कर्म को आकार देते हैं।"},
    "gu": {"title": "કર્મ પ્રવેશ", "body": "મન, વચન અને કાયાની ક્રિયાઓ દ્વારા કર્મ આત્મામાં આવે છે — કષાયથી તીવ્ર અને સમભાવથી મૃદુ.", "takeaway": "દરેક વિચાર, વચન અને ક્રિયા તમારા કર્મ-માર્ગ ઘડે છે."}
  }',
  '{"script": "Sanskrit", "text": "कायवाङ्मनःकर्म योगः"}'
),
(
  '11111111-1111-1111-1111-111111111111',
  5,
  'chunked_verse',
  'Chapter 9, Sutra 3',
  'approved',
  '{
    "en": {"title": "The Moment of Liberation", "body": "When all karmas are shed completely and the soul reaches its natural state of infinite knowledge and bliss, that is moksha — the final liberation.", "takeaway": "Freedom is not a reward; it is the soul''s natural state uncovered."},
    "hi": {"title": "मोक्ष का क्षण", "body": "जब सभी कर्म पूर्णतः नष्ट हो जाते हैं और आत्मा अनंत ज्ञान व आनंद की अवस्था को प्राप्त करती है — वही मोक्ष है।", "takeaway": "मुक्ति कोई पुरस्कार नहीं, यह आत्मा का स्वाभाविक स्वरूप है।"},
    "gu": {"title": "મોક્ષ ક્ષણ", "body": "જ્યારે સઘળાં કર્મ સમૂળ ખરી પડે છે અને આત્મા અનંત જ્ઞાન-આનંદ-સ્વરૂપ ધારણ કરે છે — તે જ મોક્ષ.", "takeaway": "મુક્તિ ઇનામ નથી — તે આત્માની સ્વાભાવિક અવસ્થા છે."}
  }',
  '{"script": "Sanskrit", "text": "बन्धहेत्वभावनिर्जराभ्यां कृत्स्नकर्मविप्रमोक्षो मोक्षः"}'
);
