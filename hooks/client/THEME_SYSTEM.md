## Theme System for Hooks

This repository ships a *platform-neutral* theme definition plus tooling that lets each client (web, React Native, or otherwise) decide exactly when and how to apply it. The template layer should only know about Tailwind class names and, when needed, supplying additional custom classes. The client is responsible for providing any runtime values such as colors, spacing, or platform-specific style objects.

### Template responsibilities

- Consume Tailwind classes via `className` and avoid embedding OS-specific branching inside the template files. The runtime helpers in [apps/client-react-native/src/tailwindRuntime.ts](apps/client-react-native/src/tailwindRuntime.ts) expose `styled`, `tailwindToStyle`, and `registerThemeStyles`, so template code can stay declarative while HookRenderer/HookDomAdapter convert those class names into native `StyleSheet` objects at render time.
- Keep theme data pure and reusable. [template/hooks/client/theme.js](template/hooks/client/theme.js) exports `THEMES`, `defaultTheme`, and the `buildClassStyles` helper so clients can derive class-level overrides without importing CSS or platform-specific modules.
- Define new or overridden classes by adding entries to `classStyleDefinitions` inside `theme.js`. Each definition can split its payload into `web`, `native`, or shared values and the client will pick whichever property makes sense for the platform.

### Client responsibilities

- Run `scripts/generate-tailwind-map.mjs` periodically (usually from `apps/client-react-native` or a shared build step). That script feeds [tailwind.config.js](apps/client-react-native/tailwind.config.js) and [src/globals.css](apps/client-react-native/src/globals.css) into Tailwind, captures every Tailwind class used within the client apps, converts the resulting CSS to React Native styles, and emits [src/generated/tailwindClassMap.generated.ts](apps/client-react-native/src/generated/tailwindClassMap.generated.ts). The generated map only contains a minimal `default` theme object so runtime overrides stay optional.
- Register any theme overrides that should exist at runtime before rendering takes place. Each client can create a tiny bootstrap module that imports `buildClassStyles`, iterates the themes it wants to expose, and calls `registerThemeStyles` from [apps/client-react-native/src/utils/tailwindMapper.ts](apps/client-react-native/src/utils/tailwindMapper.ts). For example:

```js
import { registerThemeStyles } from '<repo>/apps/client-react-native/src/tailwindRuntime'
import { buildClassStyles, THEMES } from 'template/hooks/client/theme.js'

for (const themeName of Object.keys(THEMES)) {
  registerThemeStyles(themeName, buildClassStyles(themeName))
}
```

- Supply only the overrides you need. `registerThemeStyles` is additive, so a client can start with just `defaultTheme` and later register `light`, `dark`, or any custom name as the UI surface becomes richer. The template will still render using any registered overrides plus the base classes generated at build time.
- Keep all platform-aware logic next to the client entrypoint. The template does not need to know whether it runs in React Native, a browser, or a future surface such as WebAssembly; it only emits Tailwind classes and relies on the context you provide.

### Runtime behavior

- When the template renders hooks, the HookRenderer/HookDomAdapter create a runtime `tailwindToStyle` helper that merges base classes (from the generated map) with any runtime themes registered via `registerThemeStyles`. That helper is the only place where platform-specific values (`native` vs `web`) are picked, so template authors never need to import the runtime map directly.
- Templates can still define custom classes that call into `theme.js`. Those classes become part of `buildClassStyles` which clients can register as needed and the runtime mapper will merge them on the fly.
- Because the runtime `tailwindClassMap` is deterministic and limited to the classes reachable from `apps/client-react-native` plus `apps/client-web`, clients do not need to bundle the whole `template/hooks` tree. Only the hook code that is actually executed needs to be shipped, while the map is regenerated whenever those hooks or their classes change.

### Incremental adoption

1. Ensure `scripts/generate-tailwind-map.mjs` is part of your build pipeline so the base class map stays in sync with the hook templates you ship.
2. Import `buildClassStyles` and register the themes you need via `registerThemeStyles`. Start with `defaultTheme` and add more as clients start supporting light/dark or custom palettes.
3. Keep your template code free of platform-specific imports; rely on `className` + the runtime `tailwindToStyle` glue to handle conversions.

With this setup, the repository keeps perfect knowledge of Tailwind classes and optional custom classes, while each client controls the platform-specific tokens it exposes at runtime.