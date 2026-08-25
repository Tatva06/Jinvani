# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Note (2026-08-24): this app is deliberately pinned to SDK 54, not 57

v57.0.0 is real and current (confirmed live against the npm registry and
Expo's docs on this date) — the instruction above is correct and not
stale. However, `mobile/package.json` in this repo intentionally targets
**SDK 54** (`expo ~54.0.37`, `react-native 0.81.5`, `react 19.1.0`) as of
this session, a known-behind-latest pin made consciously (not a
regression left unnoticed) after `react-native-mmkv` builds were verified
against 54 — see Phase 1 of the working session that added this note.

If you're adding a new package, run `npx expo install <package>` — it
will resolve against the *installed* SDK (54), not against whatever
`https://docs.expo.dev/versions/v57.0.0/` describes. Don't hand-pick a
version off the v57 docs and expect it to be compatible here. Revisit
this pin (retarget to whatever is then-current) as a deliberate,
scheduled piece of work, not an incidental side effect of an unrelated
change.
