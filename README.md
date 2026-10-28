# Kruthi Annanki — GLSL fabric hero

The last screenshot showed the exact visual failure: straight checks at a fixed diagonal angle. That is consistent with the CSS checker fallback, whose source uses `repeating-conic-gradient(...)` and `rotate(-9deg)`. The latest screenshot includes `CSS FALLBACK — React Three Fiber could not create a WebGL context`. That message came from the incorrectly side-effectful fallback component; it did not establish that Chrome lacked WebGL. The checks were straight because the WebGL renderer never drew the fabric.

There was a second diagnosis flaw: the prior debug badge was inside the hero's negative-z background layer, so it could sit behind the hero. A missing badge was therefore not a valid renderer diagnostic. The latest screenshot then confirmed the CSS fallback badge. The cause was the R3F Canvas `fallback` prop being given a React component with a `useEffect` that immediately called `onFailure`. R3F renders fallback content as a child of the DOM canvas; that component effect runs during normal mounting too, so the app marked itself as failed and unmounted the live renderer.

## New render path

`src/components/Checkerboard.tsx` now uses a custom vertex and fragment GLSL material. The vertex shader deforms the surface through several phase-warped diagonal fields and three differently angled travelling gathers. It derives the surface normal from the same displacement function with central differences, and sends local curvature to the fragment shader. The fragment shader makes a fixed rest-space checker from the two base colors, antialiases its edges, and shades it with directional diffuse response, broad and tight satin highlights, ridge brightening, and valley darkening. Pointer position adds an eased local traveling ripple. No CSS filter, video, or animated UV is involved.

The same shader code has a frozen `exaggerated` mode (1.28× height-only fold diagnostic) and `wireframe` view. The camera, text, page layout, and base colors have not been changed.

## Browser proof and debugging

In development, the hero's debug query renders a status badge **outside** the background stacking layer. `WEBGL CONTEXT CREATED` proves only context setup. The Canvas fallback now contains inert plain text. It cannot change React state. A custom diagnostic renderer probes `canvas.getContext('webgl2')` with conservative attributes, passes that context to Three.js, and includes browser context status in any setup error. Shader compile/link errors are routed to the console and switch the status to fallback. `glsl-flowing-checks-v5 — shader drew a frame` is set in the mesh's actual `onAfterRender`. Only after that draw does CSS hide the static fallback checker. If WebGL fails, the fixed status names the cause (context creation, context loss, shader compilation/link, or scene mounting), and the fallback stays visible. The canvas carries `data-renderer` and then `data-shader-frame`; the frame marker confirms Three.js drew that shader mesh.

```text
/?fabricDebug=exaggerated
/?fabricDebug=wireframe
/
```

The browser suite saves the exaggerated and wireframe canvas screenshots before testing normal-mode animation and input. Run `npm run test:e2e`. The previous CPU-only geometry test was removed because it does not exercise this shader renderer.

## Verified in this environment

The browser screenshot in the conversation was inspected: it shows regular straight fallback-style checks, so the previous result failed the visual target. The browser failure claim was false: the fallback child itself was marking the app failed. This side effect is removed. The exact shader appearance still needs a real browser frame.

I investigated the repeated browser blocker on this host. The Codex process has `CODEX_SANDBOX=seatbelt`; even a minimal Node server `listen(0, '127.0.0.1')` fails with `EPERM`. Chrome is installed, but Playwright reports that the launched process closes before opening a page. Network is disabled in this process. Thus the app cannot be served here and an actual browser frame cannot be captured from this turn. The status now reports actual context setup errors or shader errors if they occur. The previously open Chrome screenshot appears to come from the user's separate, unsandboxed local session, which I cannot control or inspect with this execution environment.

No new visual match is claimed. Run the development server in the user's terminal and inspect the visible badge first. If it says `CSS FALLBACK`, the console should contain the explicit WebGL/shader failure. If the shader-drew badge appears, capture `/?fabricDebug=exaggerated` and inspect whether the checks curve across the folds before tuning normal mode.


## Checker legibility refinement — 2026-10-28

The supplied reference shows a readable grid draped across high, intersecting folds. The prior v3 pass lowered the fold heights too far. In v4, checker spacing is restored to 2.45 local units, gathered XY displacement remains restrained, and the three fold heights are raised independently so the surface has stronger relief without collapsing the grid. A low-amplitude crossed drift adds curved check boundaries between the folds.

These are deliberate changes based on the screenshot, but browser screenshot capture for the refined version is still blocked in this sandbox. The Vite browser suite cannot bind localhost (`EPERM`) and Chrome exits before opening a page. Do not treat the refinement as visually approved until `/?fabricDebug=exaggerated` and normal animation have been inspected in Chrome.
