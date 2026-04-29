# GwenJs

A TypeScript port of the [GWEN](https://github.com/garrynewman/GWEN) C++ GUI library, rendered with WebGL2. GwenJs brings GWEN's retained-mode control set — buttons, windows, trees, docking panels (tabs-in-header, drag to reflow), colour pickers, property grids, file pickers, action bars, right-click menus — to the web as a single file with zero runtime dependencies. Touch and desktop share the same input path; the skin is rasterised procedurally into a GPU atlas at startup.

## Quickstart

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>GwenJs</title>
  <style>
    /* Fill the viewport. The canvas reads clientWidth/clientHeight at startup, so it needs real dimensions from CSS. */
    html, body { margin: 0; height: 100%; overflow: hidden; touch-action: none; }
    #gwen { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="gwen"></canvas>
  <script src="dist/gwen.min.js"></script>
  <script>
    // 1. Grab the host canvas and size its drawing buffer to its CSS box.
    const el = document.getElementById('gwen');
    el.width = el.clientWidth;
    el.height = el.clientHeight;

    // 2. Bootstrap the four singletons GwenJs needs:
    //      renderer  - talks to WebGL2
    //      skin      - paints the procedural atlas (no .png assets)
    //      canvas    - root control + input router
    const renderer = new Gwen.WebGL2Renderer(el);
    renderer.init();

    const skin = new Gwen.Skin(renderer);
    skin.init();

    const canvas = new Gwen.Canvas(skin, el);
    canvas.setBounds(0, 0, el.clientWidth, el.clientHeight);

    // 3. Add controls. Every control takes a parent in its constructor. canvas works as a top-level parent.
    const button = new Gwen.Button(canvas);
    button.setBounds(20, 20, 120, 24);
    button.setText('Click me');
    button.onPress.on(() => console.log('clicked'));

    // 4. Drive the per-frame loop. doThink runs layout + input housekeeping, renderCanvas paints. Both are cheap when nothing has changed.
    function frame() {
      canvas.doThink();
      canvas.renderCanvas();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  </script>
</body>
</html>
```

## Documentation

- [`docs/documentation.md`](./docs/documentation.md) - human-facing reference: installation, core concepts, docking, theming, touch, migration notes.
- [`docs/agent_docs.md`](./docs/agent_docs.md) - dense API table + cookbook aimed at AI coding agents.
- [`tasks.md`](./tasks.md) - task list that the AI agents compleated

## Build and test

```
npm install
npm run build           # produces dist/gwen.js + dist/gwen.min.js + dist/demo.js
npm run typecheck       # strict tsc
npm test                # Playwright, desktop + iPhone 13 projects
npm run serve           # http://localhost:8080/demo/
```

## License

MIT (inherits from upstream GWEN).