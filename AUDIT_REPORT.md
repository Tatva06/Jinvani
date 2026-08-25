# Jinvani Mobile App — Code Audit

Scope: `mobile/` (Expo Router / RN) + `backend/` (FastAPI / Supabase). Audited against the working tree as of 2026-08-24 (uncommitted changes included — see git diffs cited inline). All file paths are repo-root-relative.

---

## 1. Project Structure & Architecture

**Actual routing tree** (`expo-router`, file-based):

```
mobile/app/_layout.tsx           — root Stack, GestureHandlerRootView, SafeAreaProvider, theme bootstrap
mobile/app/(tabs)/_layout.tsx    — Tabs: index / topics / settings
mobile/app/(tabs)/index.tsx      — Feed screen (route) + JinvaniCard component + ~90 lines of StyleSheet, all in one file
mobile/app/(tabs)/topics.tsx     — Topics screen (route) + hardcoded TOPICS data + styles
mobile/app/(tabs)/settings.tsx   — Settings screen (route) + SettingsRow component + styles
mobile/src/api/client.ts         — fetchFeed()
mobile/src/store/useFeedStore.ts — zustand: cards/language/topicFilter
mobile/src/store/useThemeStore.ts— zustand: theme, persisted to AsyncStorage
mobile/src/theme.ts              — Colors token table
mobile/src/types.ts              — Language, CardContent, SeedCard
mobile/src/constants.ts          — API_BASE_URL (hardcoded LAN IP)
mobile/src/seedData.ts           — 3 hardcoded fallback cards
```

The migration from a bare RN entry (`App.tsx` / `index.ts`, both deleted in the working tree) to `expo-router/entry` (`mobile/package.json:4`) is complete and consistent — no leftover references to the old entry point.

**Structural issues:**

- **[Medium] No `components/` directory — UI components live inside route files.** `mobile/app/(tabs)/index.tsx:25-88` defines the entire `JinvaniCard` presentational component (and `mobile/app/(tabs)/index.tsx:187-215`, its ~30-rule StyleSheet) directly inside the route file. Same pattern in `settings.tsx:24-49` (`SettingsRow`) and implicitly in `topics.tsx` (inline `TOPICS` data array at `topics.tsx:17-24`). Standard Expo Router convention keeps route files thin (screen composition + navigation only) and pushes reusable UI into a sibling `components/` or `features/` tree. Here, data/state (`src/store`, `src/api`) *is* well separated — only the UI layer is merged into routing.
- **[Low] No env-driven config.** `mobile/src/constants.ts:7` hardcodes `API_BASE_URL = 'http://192.0.0.2:8000'` with a code comment instructing developers to manually edit the IP per platform/network. There is no `app.config.js` + `expo-constants` `extra` block, and no mobile-side `.env` consumption (`mobile/.env` is gitignored per `.gitignore:7` but nothing reads it). This belongs in config, not a literal in `src/constants.ts`.

---

## 2. Performance — Card Feed & Rendering

`mobile/app/(tabs)/index.tsx:171-182`:
```tsx
<FlashList
  data={cards}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  extraData={{ lang: language, themeMode: theme }}
  pagingEnabled={Platform.OS === 'ios'}
  snapToInterval={SCREEN_HEIGHT}
  snapToAlignment="start"
  decelerationRate="fast"
  showsVerticalScrollIndicator={false}
  bounces={false}
/>
```

- **[Low] No `estimatedItemSize`.** FlashList `2.0.2` is installed (confirmed via `node_modules/@shopify/flash-list/package.json`), and v2 no longer *requires* `estimatedItemSize`. Still, item height here is a fixed, known constant (`SCREEN_HEIGHT`, computed once at module load via `Dimensions.get('window')`, `index.tsx:20`) — supplying it costs nothing and removes any first-mount measurement pass.
- **[Medium] `extraData` is a fresh object literal every render.** `extraData={{ lang: language, themeMode: theme }}` (`index.tsx:175`) creates a new object identity on every `FeedScreen` render (e.g. whenever `topicFilter` changes and the topic banner mounts/unmounts), even when `language`/`theme` values haven't changed. FlashList treats `extraData` identity as the re-render trigger for cells. It isn't memoized with `useMemo`. `renderItem` (`index.tsx:109-122`) and `keyExtractor` (`index.tsx:124`) *are* correctly wrapped in `useCallback` with stable/empty deps — only `extraData` is the miss.
- **[High] The "sliding window ±2 cards" memory strategy described for this app does not exist in code.** `useFeedStore.cards` (`mobile/src/store/useFeedStore.ts:7,18`) is a single flat in-memory array holding every card returned by the last `fetchFeed()` call (capped at `limit=20`, `useFeedStore.ts:38`). There is no windowing hook, no scroll-index-based slicing, and no eviction of off-screen card data — FlashList only virtualizes the *native views* it renders, not the JS data array. Compounding this: **there is no pagination** — no `onEndReached` handler is wired on the `FlashList` (confirmed absent by search), so scrolling past the initial 20 cards simply ends the list; nothing fetches page 2.
- **[High] Reanimated / gesture-handler / worklets are installed but entirely unused.** `react-native-reanimated` (`mobile/package.json:18`, `4.1.7` installed), `react-native-worklets` (`package.json:21`), and `react-native-gesture-handler` (`package.json:16`, root-wrapped via `GestureHandlerRootView` in `app/_layout.tsx:20`) have **zero call sites** anywhere in `mobile/src` or `mobile/app` — no `useSharedValue`, `useAnimatedStyle`, `withTiming`, `Gesture.*`, or `PanGestureHandler`. There is no card-flip animation of any kind. All transitions between cards rely on native `pagingEnabled`/`snapToInterval` scroll behavior (`index.tsx:176-179`), not a custom worklet-driven interaction. The described flip feature is simply not implemented, and the app is shipping ~3 heavy native modules for nothing.
- **[Low] `Dimensions.get('window')` at module scope (`index.tsx:20`) instead of `useWindowDimensions()`.** Won't react to runtime size changes (split-screen, foldables). Low impact today since `app.json` locks `orientation: "portrait"` (`mobile/app.json:7`), but it's a static-at-import anti-pattern that will silently break card height if that constraint is ever relaxed.
- No unmemoized inline function/object props were found inside `JinvaniCard` itself (`index.tsx:25-88`) — the component is correctly `React.memo`'d (`index.tsx:25,88`) and its body does only cheap prop reads (e.g. `card.content[language] || card.content['en']`, `index.tsx:33`).

---

## 3. Trilingual / i18n Implementation

- **Payload shape confirmed consistent end-to-end.** `SeedCard.content: Record<Language, CardContent>` (`mobile/src/types.ts:15,25`) matches the Postgres schema's documented JSONB shape (`backend/schema.sql:52-53`: `{"en": {...}, "hi": {...}, "gu": {...}}`) and the actual seed data (`mobile/src/seedData.ts`, `backend/seed_extra_cards.sql`).
- **[Good] Language switching is a local, network-free re-render.** `setLanguage` (`useFeedStore.ts:29-31`) only calls `set({ language: lang })` — the `cards` array reference is untouched, so `FlashList`'s `data` prop doesn't change and scroll position is preserved. No fetch is triggered on language change. This part works as intended.
- **[Low] Silent fallback to English with no indicator.** `content[language] || content['en']` (`index.tsx:33`) means a partially-translated card silently renders English body text under the Hindi/Gujarati toggle with no visual cue that the user is seeing a fallback.
- **[High] Fonts: no Devanagari/Gujarati font is bundled.** No `expo-font`/`useFonts` usage and no `.ttf`/`.otf` assets exist anywhere in the repo (confirmed via file search and grep across `mobile/src` and `mobile/app`). All Hindi/Gujarati text renders on whatever system font the OS/OEM supplies — coverage and visual match to the app's tuned Latin typography (e.g. `cardTitle` at `index.tsx:197`, `letterSpacing: -0.3`, `fontWeight: '700'`) is unverified and will vary by device.
- **[High] The trilingual system covers card *content* only — app chrome is English-only regardless of the selected language.** None of these read `language` from the store:
  - `"Key Takeaway"` — `index.tsx:78`
  - Settings screen: `"Settings"`, `"Appearance"`, `"Dark Mode"`, `"Default Language"`, `"Notifications"`, `"Daily Reminder"`, `"Get a card every morning"`, `"About"` — `settings.tsx:68,71,73,91,118,120,121,134`
  - Topics screen: `"Explore Topics"`, `"Filter scripture cards by subject."`, `"All Topics"`, `"Categories"`, plus every topic's `name`/`description` (`"Philosophy"`, `"Foundations of reality, soul and metaphysics."`, etc.) — `topics.tsx:17-24,48-89`
  A Hindi/Gujarati-preferring user still sees an entirely English shell around translated card content.
- **[High] Word-count validation does not exist, at any granularity.** `mobile/src/types.ts:6,8` only *documents* the intent in JSDoc comments (`≤ 8 words`, `60-word scripture summary`) — there is no runtime enforcement. `backend/models.py:15` types `content` as an untyped `dict[str, Any]`, and `backend/schema.sql:69` stores it as an unconstrained `JSONB NOT NULL DEFAULT '{}'`. No client-side check either. Even a naive global word cap would be the wrong unit for Hindi/Gujarati content (space-delimited "words" don't carry comparable information density across scripts) — but currently there is not even a single global number enforced anywhere.
- **[Medium] Consequence of the above: cards have a fixed-height layout with no overflow handling.** `styles.card` is `height: screenHeight` (`index.tsx:189`), `cardInner` uses `justifyContent: 'space-between'` with no `ScrollView`, and `bodyText` has no `numberOfLines` cap (`index.tsx:60,199`). Any body text exceeding the intended ~60-word budget will silently overflow/clip against the takeaway box beneath it — a direct, demonstrable consequence of the missing length validation above.

---

## 4. State & Offline Storage

- **Store split is reasonable**, not a mega-store: `useFeedStore` (cards/language/topicFilter, `mobile/src/store/useFeedStore.ts`) and `useThemeStore` (theme, `mobile/src/store/useThemeStore.ts`) are separated by domain. No derived state is stored where it should be computed — both stores hold only primitive/source state.
- **[High] MMKV is not used anywhere — it was removed from the dependency tree in the current uncommitted working-tree change.** `git diff mobile/package.json` shows the previously-committed baseline (`git show HEAD:mobile/package.json`) had `"react-native-mmkv": "^4.3.2"`; the current working tree drops it entirely and adds `@react-native-async-storage/async-storage` instead (`mobile/package.json:6,17` — see §8 for the duplicate-key issue on that same line). Only `useThemeStore.ts:17,24,32` uses `AsyncStorage`, and only to persist a single theme string — trivial size, not itself a perf risk, but it means the app's actual persistence layer no longer matches the MMKV-based architecture this audit was briefed against.
- **[Medium] `language` (the trilingual preference) is not persisted at all**, unlike `theme`. `useFeedStore.setLanguage` (`useFeedStore.ts:29-31`) only calls `set(...)` — no `AsyncStorage`/MMKV write. Closing and reopening the app always resets the language to `'en'` (the store's initial value, `useFeedStore.ts:22`), even though the user explicitly chose Hindi/Gujarati last session, and even though `Settings` screen implies this is meant to be a durable preference (`settings.tsx:91` "Default Language").
- **Cold start / failed fetch behavior, traced end-to-end:**
  1. `useFeedStore.cards` initializes to the 3 hardcoded `SEED_CARDS` (`useFeedStore.ts:18`, `mobile/src/seedData.ts`).
  2. `FeedScreen`'s mount effect (`index.tsx:105-107`) runs once with `urlTopic` undefined → calls `setTopic(null)` → which calls `loadFeed()` (`useFeedStore.ts:24-27`) — so a live fetch **is** triggered on cold start.
  3. On success, `cards` is replaced with live Supabase data (`useFeedStore.ts:40`).
  4. On failure (`useFeedStore.ts:50-54`), it falls back to `SEED_CARDS` and sets `error` to the exception message — but **no component in the app ever reads `useFeedStore`'s `error` or `isLoading` fields** (confirmed via search: both are only referenced inside `useFeedStore.ts` itself). A failed fetch is silently swallowed from the user's point of view: no loading spinner, no retry affordance, no error banner — the user just sees the 3 seed cards forever with no indication anything went wrong.
- **[Low] No cache-then-network pattern for the fetched feed.** Nothing persists the last successful `fetchFeed()` response to MMKV/AsyncStorage, so every cold start with connectivity re-fetches before showing anything beyond the 3 baked-in samples. The brief's stated Cloudflare KV/R2 edge cache has no corresponding code anywhere in this repo (no Cloudflare config, Worker, or client reference found) — it appears to be aspirational/not-yet-started infrastructure.

---

## 5. Data Layer / Supabase Integration

**Schema comparison** (`backend/schema.sql`) vs. expected tables:

| Expected | Present? | Notes |
|---|---|---|
| `books` | **Missing** | `decks.book_id` is a bare `TEXT` column (`schema.sql:35`) with no FK — "books" is just a free-text label, no referential integrity, no book-level metadata table exists. |
| `decks` | ✓ (`schema.sql:33-46`) | |
| `cards` (content JSONB en/hi/gu, `card_type` enum, `status` enum) | ✓ (`schema.sql:58-79`) | `card_type_enum` and `card_status_enum` both present and match the brief. |
| `glossary_terms` | **Missing** | No table, no route, no reference anywhere in `backend/`. |
| `training_feedback` | **Missing** | Same — absent entirely. |

Two tables exist beyond the brief: `user_stash` (bookmarks, `schema.sql:85-96`) and `telemetry_events` (`schema.sql:102-118`) — reasonable additions, not a problem, just noted for completeness.

- **[High] 3 of 5 expected tables are simply absent.** No scholar annotation workflow (`glossary_terms`) and no reviewer/ML feedback loop (`training_feedback`) has any backend support at all yet.
- **No SQL injection surface found.** Both routers (`backend/routers/feed.py`, `backend/routers/bookmarks.py`) exclusively use the Supabase Python client's fluent query builder (`.table().select().eq()...`) — no raw/interpolated SQL strings anywhere in the two route files.
- **RLS review** (`schema.sql:124-145`):
  - `cards` SELECT restricted to `status = 'approved'` for everyone (`schema.sql:130-131`) — matches the defense-in-depth filter already applied server-side in `feed.py:28,40` (`.eq("status", "approved")`). Good, belt-and-suspenders.
  - `decks` SELECT is `USING (true)` — fully public (`schema.sql:133-134`), acceptable since decks carry no sensitive data.
  - `user_stash` correctly scoped to the owning user via `auth.uid()` (`schema.sql:136-139`).
  - `users` SELECT is self-only (`schema.sql:141-142`) — **but there is no INSERT policy for `public.users` at all**, and no code anywhere in `backend/` ever inserts a row into `public.users` (confirmed via search — no `.table("users")` call exists in either router or `main.py`). Combined with the fact that **no route in the mobile app ever calls the bookmarks endpoint** (confirmed via search — `"bookmark"` appears nowhere in `mobile/src` or `mobile/app`), the `/api/v1/bookmarks` endpoint (`backend/routers/bookmarks.py`) is currently dead code end-to-end: unreachable from the client, and would fail for any real user since `BookmarkRequest.user_id` (`backend/models.py:27`) has no path that ever creates the referenced `users` row. **[High]**
  - No scholar-only vs. public distinction exists anywhere — only public-approved vs. everything-else. Acceptable for a prototype but a real gap against the brief's expectation of scholar-only access tiers. **[Medium]**
- **Error handling:** Server-side, both routers wrap every Supabase call in `try/except` → `HTTPException(502)` (`feed.py:47-49`; `bookmarks.py:31-33,45-47,59-64`), so failures are surfaced as proper HTTP errors, not swallowed. Client-side, `useFeedStore.ts:50-54` catches and silently falls back with only a `console.warn` — no user-facing surface (cross-referenced in §4/§9). **[Medium]**
- **[Medium] CORS misconfiguration.** `backend/main.py:58-64`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=True,
      ...
  )
  ```
  Per the Fetch spec a literal wildcard is illegal alongside credentials; Starlette's `CORSMiddleware` handles this combination by reflecting the request's actual `Origin` header back instead of a literal `*` — the practical effect is that **any** origin can make a credentialed request. Not exploitable today (the API takes no cookies/auth headers from the client currently), but it's a footgun the moment session-based auth is added on top of this same middleware config.

---

## 6. Media Handling

**Not applicable yet — no media pipeline exists.** A search across `mobile/src` and `mobile/app` for `Image`/`expo-image` usage returned nothing; the app is currently 100% text/JSON-driven. Noting this explicitly rather than skipping it: when images are added (e.g. deity/verse illustrations), plan for `expo-image` (caching + `contentFit` + memory-aware sizing) rather than core RN `Image`, and factor bitmap memory into the FlashList windowing story addressed in §2.

---

## 7. Security & Secrets

- **[CRITICAL] A live, real Supabase project URL and anon key are committed in the current working tree at `backend/.env.example:1-2`:**
  ```
  SUPABASE_URL=https://[REDACTED-PROJECT-REF].supabase.co
  SUPABASE_KEY=[REDACTED-ANON-JWT — see rotation recommendation below]
  ```
  `git diff backend/.env.example` confirms this replaced the prior committed placeholder values (`https://<your-project-ref>.supabase.co`, `<your-anon-public-key>`) — this is an **uncommitted** change sitting in the working tree right now, one `git add`/`commit`/`push` away from landing permanently in shared history. Worse, the local gitignored `backend/.env` (which correctly holds the real dev credentials, per `.gitignore:12`) is **byte-identical** to this now-modified `.env.example` — confirming these are the actual live working credentials, not placeholder-looking dummy data. Decoding the JWT payload confirms `"role":"anon"` (not a service-role key), so Postgres RLS still gates data access — but the project ref is now exposed publicly-shareable, and the key should be rotated the moment it's known to have left `.env`.
  **Fix:** revert `backend/.env.example` to placeholder values before any commit, and rotate this anon key regardless, since it has already existed in a diff.
- No service-role key was found anywhere in the repository (good). `backend/main.py:31-32` reads secrets via `os.environ["SUPABASE_URL"]` / `os.environ["SUPABASE_KEY"]` (hard-fails on startup if unset — no silent insecure default). `backend/.env` is correctly excluded from git via `.gitignore:12`.
- **[High]** `mobile/src/constants.ts:7` hardcodes a plain LAN IP as the *only* API base URL, with no environment-driven override mechanism (no `app.config.js` + `expo-constants extra`, no mobile `.env` consumption). Not a secret, but a shipping-readiness security/config issue: a production build would silently point at a developer's home network unless someone remembers to hand-edit this file before every release build.
- Mobile client currently sends no auth token/API key of its own (feed is intentionally public/anon) — consistent with the current public-read RLS policy, no leak on that front.

---

## 8. Dependencies & Tooling

- **[High] Dependency/SDK regression in the current uncommitted working tree.** `git diff mobile/package.json` against the last commit (`git show HEAD:mobile/package.json`) shows:

  | Package | Committed (HEAD) | Working tree (current) |
  |---|---|---|
  | `expo` | `~57.0.15` | `~54.0.37` |
  | `react-native` | `0.86.2` | `0.81.5` |
  | `react` | `19.2.3` | `19.1.0` |
  | `typescript` | `~6.0.3` | `~5.8.0` |
  | `react-native-mmkv` | `^4.3.2` | **removed** |
  | `react-native-gesture-handler` | `~2.32.0` | `~2.28.0` |

  This directly contradicts the repo's own `mobile/AGENTS.md`, which instructs: *"Expo HAS CHANGED — read the exact versioned docs at `https://docs.expo.dev/versions/v57.0.0/` before writing any code"* — i.e. the project's own agent instructions assume Expo 57, which matches the **committed** baseline, while the current working tree has moved three SDK minors backward and silently dropped MMKV. This should be confirmed with the team as intentional (e.g. rolling back due to an SDK 57 compatibility issue) before it's merged — as-is it reads as an accidental or unreviewed regression.
- **[Low] Duplicate JSON key in `mobile/package.json`.** Lines 6 and 17 both declare `"@react-native-async-storage/async-storage"` — once as `"2.2.0"` (line 6) and again as `"2.1.2"` (line 17). Most JSON/JS parsers silently keep the *last* occurrence; `package-lock.json` confirms `2.1.2` is what's actually installed, so the `2.2.0` line is dead and misleading.
- **[Medium] Heavy native deps installed but unused.** `react-native-reanimated`, `react-native-worklets`, and `react-native-gesture-handler` are all present in `package.json` and increase native build size/complexity, but have zero call sites in the app (cross-ref §2) — either build the flip/gesture feature they were added for, or remove them until it's scheduled.
- `react-native-screens`, `expo-linking`, `expo-constants` are appropriately present as standard `expo-router` peer/runtime deps — no issue.
- **[Low]** `backend/requirements.txt` pins only floors (`fastapi>=0.115.0`, etc.) with no upper bounds or exact pins — acceptable for a prototype, but installs aren't reproducible across machines/time; worth exact-pinning (or a lockfile via `pip-compile`/`uv`) before anything beyond local dev.

---

## 9. Testing & Error Boundaries

- **[High] Zero test coverage.** No `*.test.*`/`*.spec.*` files exist anywhere in `mobile/` or `backend/` (outside `node_modules`/`venv`). No test runner is configured — `mobile/package.json` has no `jest`/`@testing-library/react-native` devDependency, `backend/requirements.txt` has no `pytest`. Expected for an early-stage prototype, but flagged as a real gap the moment more than one person touches this code.
- **[High] No React error boundary anywhere in the mobile app.** `mobile/app/_layout.tsx` renders `<Stack>` directly with no boundary wrapping it (confirmed via search: `"ErrorBoundary"` appears nowhere in `mobile/src` or `mobile/app`). Concrete failure path traced end-to-end:
  1. `api/client.ts:34` maps a Supabase row's content field as `content: c.content || {}` — if a card row has `content: null` or is missing the field, this resolves to an empty object `{}`, which is **not** a valid `Record<Language, CardContent>`.
  2. `index.tsx:33`: `const content = card.content[language] || card.content['en'];` — with `content = {}`, both lookups are `undefined`.
  3. `index.tsx:58,60,80`: `content.title`, `content.body`, `content.takeaway` are accessed directly on that `undefined` value → `TypeError: Cannot read properties of undefined` thrown during render.
  4. `FlashList` does not isolate per-item render errors, and with no `ErrorBoundary` above it, this crashes the entire app to a blank/red screen with no recovery path for the user.
  Since `backend/models.py:15` types `content` as an unconstrained `dict[str, Any]` (§3, §5) and the DB column has no shape constraint either, a single malformed row inserted via the Supabase dashboard (or a future admin/CMS tool) is enough to trigger this for every user on next fetch.
  **Fix:** wrap `Stack`/`FlashList` in an `ErrorBoundary`, and normalize/validate the `content` shape in `api/client.ts` (fall back to a "content unavailable" placeholder per language, never an empty object) before it reaches the store.
- No error boundary exists specifically around the language switch or network layer either — both are simple enough today that they're unlikely to throw on their own, but they inherit the same lack of any top-level boundary.

---

## 10. Summary

**Top 5 issues, ranked by severity:**

1. **[Critical] Live Supabase URL + anon key committed in the working tree** at `backend/.env.example:1-2` (§7). **Fix:** revert to placeholder values before any commit; rotate the anon key since it already left `.env`.
2. **[High] No error boundary + unguarded `content` shape from the API can crash the entire app on a single malformed card** (`api/client.ts:34` → `index.tsx:33,58,60,80`, §9). **Fix:** add a top-level `ErrorBoundary` and normalize/validate `content` in `api/client.ts` before it reaches the store.
3. **[High] The app's described core mechanics — sliding-window ±2 card memory management and worklet-driven card-flip animation — are not implemented at all**; the relevant dependencies (`reanimated`, `worklets`, `gesture-handler`) are installed but have zero call sites, and there's no feed pagination past the first 20 cards (§2). **Fix:** either implement these against the architecture doc, or explicitly descope them for the current prototype milestone; add `onEndReached` pagination at minimum.
4. **[High] Trilingual coverage stops at card content — all app chrome (Settings, Topics, "Key Takeaway") is English-only regardless of selected language, and no Devanagari/Gujarati font is bundled** (§3). **Fix:** extract chrome strings into a `Record<Language, string>` dict keyed by the existing `Language` type; bundle a Devanagari + Gujarati font via `expo-font`/`useFonts`.
5. **[High] Unreviewed dependency regression in the working tree**: Expo 57→54, RN 0.86.2→0.81.5, and `react-native-mmkv` dropped entirely for `AsyncStorage`, contradicting the project's own `mobile/AGENTS.md` (which assumes Expo 57) (§4, §8). **Fix:** confirm with the team whether this was intentional before merging; if not, revert to the prior lockfile state.

**Blocks a working prototype demo today:**
- Issue #1 (secret leak) — must be fixed before any push/share, full stop.
- Issue #2 (crash risk) — real risk given the schema enforces no shape on `content`; one bad row (manually inserted via Supabase dashboard, as `seed_extra_cards.sql` already demonstrates is the current authoring workflow) takes down every user's app.
- The bookmarks feature (`backend/routers/bookmarks.py`) is dead end-to-end — unused by the mobile client and non-functional even if called, since nothing ever creates the `public.users` row it depends on (§5). Not demo-blocking *unless* bookmarks are meant to be shown; flag before demo day if so.

**Later-stage, non-blocking for a first walkthrough:**
- Card-flip animation, sliding-window/pagination, chrome i18n, bundled fonts, test coverage, exact dependency pinning, CORS hardening, `glossary_terms`/`training_feedback`/`books` tables, scholar-only RLS tier.
- The current 3-tab flow (Feed / Topics / Settings) does functionally work end-to-end against the live Supabase backend today — language switching, topic filtering, and theme persistence all behave correctly for the happy path.
