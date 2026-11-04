// What the build (tsconfig.build.json) sees where the typecheck sees the app's bridge types (app/src/shell/desktop-bridge.ts):
// the build may only read files under src/, so it maps 'lathe-desktop-bridge' here, to types that accept anything. The
// preload is checked against the real bridge by `npm run typecheck`; the build only emits it.
export type LatheDesktop = object;
export type AppRequest = any;
export type ChatPatch = any;
export type VoiceEvent = any;
export type SignInState = any;
