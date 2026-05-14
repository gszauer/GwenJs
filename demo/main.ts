// GwenJs demo — UnitTest-style showcase mirroring `GWEN/gwen/UnitTest`.
// Layout matches the original SFML2 sample:
//   * MenuStrip docked Top (File / Edit / Help).
//   * StatusBar docked Bottom.
//   * "Output" log panel docked Bottom (above the status bar).
//   * CollapsibleList on the left with 5 categories of demo names.
//   * A single center panel that swaps contents when a sidebar row fires.

import * as Gwen from '../src/index.js';

// ---------------------------------------------------------------------------
// Host canvas + renderer + skin bootstrap.
// ---------------------------------------------------------------------------

const htmlCanvas = document.getElementById('gwen-canvas') as HTMLCanvasElement | null;
if (!htmlCanvas) throw new Error('#gwen-canvas missing');

const dpr = window.devicePixelRatio || 1;
const sizeCanvas = (): void => {
  htmlCanvas.width = Math.floor(htmlCanvas.clientWidth * dpr);
  htmlCanvas.height = Math.floor(htmlCanvas.clientHeight * dpr);
};
sizeCanvas();

const renderer = new Gwen.WebGL2Renderer(htmlCanvas, { devicePixelRatio: dpr });
renderer.init();

const skin = new Gwen.Skin(renderer);
skin.init();

const canvas = new Gwen.Canvas(skin, htmlCanvas);
canvas.setBounds(0, 0, htmlCanvas.clientWidth, htmlCanvas.clientHeight);
canvas.setDrawBackground(true);
// Helper that translates the active palette's `canvasBg` (a hex / rgba
// string) into the byte Color the renderer expects. Lets the demo swap
// the canvas backdrop in lock-step with skin theme switches.
function applyCanvasBgFromTheme(): void {
  const hex = skin.getPalette().canvasBg;
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  canvas.setBackgroundColor(Gwen.color((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255));
}

const themedIconButtons: Gwen.Button[] = [];

function isDarkTheme(): boolean {
  const hex = skin.getPalette().canvasBg;
  if (!hex.startsWith('#')) return false;
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) < 128;
}

function themedIconColor(): Gwen.Color {
  return isDarkTheme() ? Gwen.color(214, 214, 214, 255) : Gwen.color(42, 42, 42, 255);
}

function applyThemedIconColor(): void {
  const c = themedIconColor();
  for (let i = themedIconButtons.length - 1; i >= 0; i--) {
    const b = themedIconButtons[i];
    if (!b.parent) {
      themedIconButtons.splice(i, 1);
      continue;
    }
    b.setImageColor(c);
  }
}

function registerThemedIconButton<T extends Gwen.Button>(button: T): T {
  themedIconButtons.push(button);
  button.setImageColor(themedIconColor());
  return button;
}

applyCanvasBgFromTheme();
canvas.redraw();

document.getElementById('boot-msg')?.remove();

// Expose for inspection from preview scripts.
(window as unknown as { __gwen: unknown }).__gwen = { canvas, skin, renderer };

// ---------------------------------------------------------------------------
// Bundled icons — generated via Canvas2D so the demo ships zero asset files.
// ---------------------------------------------------------------------------

function makeSmileyTexture(): Gwen.Texture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = true;
  // Yellow face.
  g.fillStyle = '#f0d040';
  g.beginPath();
  g.arc(16, 16, 14, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#806020';
  g.lineWidth = 1.5;
  g.stroke();
  // Eyes.
  g.fillStyle = '#202020';
  g.beginPath();
  g.arc(11, 13, 2, 0, Math.PI * 2);
  g.arc(21, 13, 2, 0, Math.PI * 2);
  g.fill();
  // Smile.
  g.strokeStyle = '#202020';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(16, 17, 6, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
  const tex = Gwen.texture('smiley');
  renderer.loadTextureFromSource(tex, c);
  return tex;
}

function makeGwenLogoTexture(): Gwen.Texture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d')!;
  // Pink/magenta background.
  g.fillStyle = '#e62a8e';
  g.fillRect(0, 0, 96, 96);
  // White border.
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 92, 92);
  // GWEN text.
  g.fillStyle = '#ffffff';
  g.font = 'bold 22px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('GWEN', 48, 36);
  // Gear/flower wheel.
  g.translate(48, 64);
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4);
    g.fillRect(-4, -16, 8, 12);
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(0, 0, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e62a8e';
  g.beginPath();
  g.arc(0, 0, 3, 0, Math.PI * 2);
  g.fill();
  const tex = Gwen.texture('gwen-logo');
  renderer.loadTextureFromSource(tex, c);
  return tex;
}

const smileyTexture = makeSmileyTexture();
const gwenLogoTexture = makeGwenLogoTexture();

// ---------------------------------------------------------------------------
// Top: MenuStrip.
// ---------------------------------------------------------------------------

const menuStrip = new Gwen.MenuStrip(canvas);
{
  const fileMenu = menuStrip.addItem('File');
  fileMenu.getMenu().addItem('New').setAccelerator('Ctrl+N');
  fileMenu.getMenu().addItem('Load').setAccelerator('Ctrl+L');
  fileMenu.getMenu().addItem('Save').setAccelerator('Ctrl+S');
  fileMenu.getMenu().addItem('Save As...').setAccelerator('Ctrl+Shift+S');
  fileMenu.getMenu().addDivider();
  fileMenu.getMenu().addItem('Quit').setAccelerator('Ctrl+Q');

  const editMenu = menuStrip.addItem('Edit');
  editMenu.getMenu().addItem('Cut').setAccelerator('Ctrl+X');
  editMenu.getMenu().addItem('Copy').setAccelerator('Ctrl+C');
  editMenu.getMenu().addItem('Paste').setAccelerator('Ctrl+V');

  const subMenu = menuStrip.addItem('Help');
  const about = subMenu.getMenu().addItem('About');
  const sub = subMenu.getMenu().addItem('Submenu');
  // Demonstrate the icon gutter: Help's nested submenu reserves the
  // 24px left column even though First/Second/Third don't carry icons.
  sub.getMenu().setShowIconMargin(true);
  sub.getMenu().addItem('First');
  sub.getMenu().addItem('Second');
  sub.getMenu().addItem('Third');
  void about;

  // Skin submenu — Light / Dark, currently-active item carries a
  // check in the icon gutter. Theme switch repaints the atlas in
  // place so every existing control picks up new colors on next
  // render — no reconstruction needed.
  const skinSub = subMenu.getMenu().addItem('Skin');
  skinSub.getMenu().setShowIconMargin(true);
  const lightItem = skinSub.getMenu().addItem('Light');
  const darkItem = skinSub.getMenu().addItem('Dark');
  lightItem.setCheckable(true);
  darkItem.setCheckable(true);
  lightItem.setChecked(true); // Light is the default.
  const applyTheme = (palette: Gwen.Palette, light: boolean): void => {
    skin.setTheme(palette);
    applyCanvasBgFromTheme();
    applyThemedIconColor();
    lightItem.setChecked(light);
    darkItem.setChecked(!light);
    canvas.redraw();
    log(`Skin: ${light ? 'Light' : 'Dark'}`);
  };
  lightItem.onMenuItemSelected.on(() => applyTheme(Gwen.LIGHT_PALETTE, true));
  darkItem.onMenuItemSelected.on(() => applyTheme(Gwen.DARK_PALETTE, false));
}

// ---------------------------------------------------------------------------
// Bottom: StatusBar.
// ---------------------------------------------------------------------------

const statusBar = new Gwen.StatusBar(canvas);
statusBar.setText(`GwenJs Unit Test — v${Gwen.VERSION}`);

// ---------------------------------------------------------------------------
// Canvas-level global right-click menu — Cut / Copy / Paste. Fires on
// any right-click whose hovered control's `onContextMenuRequest` chain
// doesn't override (the bubble walks all the way up to the canvas).
// Specific demos (e.g. the RightClick demo's panel + button) override
// at their own level; everything else falls back to this.
// ---------------------------------------------------------------------------

const globalMenu = new Gwen.Menu(canvas);
{
  const cut = globalMenu.addItem('Cut');
  cut.setAccelerator('Ctrl+X');
  cut.onMenuItemSelected.on(() => log('Global menu: Cut'));
  const copy = globalMenu.addItem('Copy');
  copy.setAccelerator('Ctrl+C');
  copy.onMenuItemSelected.on(() => log('Global menu: Copy'));
  const paste = globalMenu.addItem('Paste');
  paste.setAccelerator('Ctrl+V');
  paste.onMenuItemSelected.on(() => log('Global menu: Paste'));
}
canvas.setContextMenu(globalMenu);

// ---------------------------------------------------------------------------
// DockBase — root four-edge dockable container, mirroring GWEN UnitTest.
// The CollapsibleList sidebar (left) and Output log (bottom) live as tabs
// inside docked tab controls; their tab buttons can be torn off and
// reparented onto any other DockBase edge for IDE-style layout shuffling.
// The fill area hosts the demo panels that swap on sidebar selection.
// ---------------------------------------------------------------------------

const dock = new Gwen.DockBase(canvas);
dock.dock(Gwen.Pos.Fill);

// LEFT dock — CollapsibleList tab.
const leftDock = dock.getLeft();
leftDock.setWidth(190);
const sidebarPage = new Gwen.Base(null);
const catList = new Gwen.CollapsibleList(sidebarPage);
catList.dock(Gwen.Pos.Fill);
leftDock.getTabControl()?.addPage('CollapsibleList', sidebarPage);

// BOTTOM dock — Output tab.
const bottomDock = dock.getBottom();
bottomDock.setHeight(150);
const outputPage = new Gwen.Base(null);
const outputList = new Gwen.ListBox(outputPage);
outputList.dock(Gwen.Pos.Fill);
outputList.addItem('Unit Test Started');
bottomDock.getTabControl()?.addPage('Output', outputPage);

function log(msg: string): void {
  outputList.addItem(msg);
  outputList.scrollToBottom();
}

// FILL area — center panel where demos render. Demo sections stack here
// and only one is visible at a time, swapped by `showDemo(name)`.
const centerPanel = new Gwen.Base(dock);
centerPanel.dock(Gwen.Pos.Fill);
centerPanel.setMargin(Gwen.margin(4, 4, 4, 4));

const demoSections: Record<string, Gwen.Base> = {};
const demoRows: Record<string, Gwen.Button> = {};

function addDemo(
  category: Gwen.CollapsibleCategory,
  name: string,
  build: (parent: Gwen.Base) => void,
): void {
  const panel = new Gwen.Base(centerPanel);
  panel.dock(Gwen.Pos.Fill);
  panel.hide();
  build(panel);
  demoSections[name] = panel;

  const row = category.add(name);
  demoRows[name] = row;
  row.onPress.on(() => showDemo(name));
}

function showDemo(name: string): void {
  for (const k of Object.keys(demoSections)) {
    demoSections[k].setHidden(k !== name);
  }
  // Drive the sidebar selection from showDemo too so the default-open
  // demo (showDemo('Button') at the end of setup) starts highlighted in
  // the CollapsibleList. Clear every row first so cross-category
  // exclusivity holds even when the call comes from JS rather than a
  // row click.
  catList.unselectAll();
  const row = demoRows[name];
  if (row) row.setToggleState(true);
  log(`Opened: ${name}`);
}

// ---------------------------------------------------------------------------
// BASIC category
// ---------------------------------------------------------------------------

const basicCat = catList.add('Basic');

addDemo(basicCat, 'Button', (p) => {
  const b1 = new Gwen.Button(p);
  b1.setText('Event Tester');
  b1.setBounds(220, 30, 150, 22);
  b1.onPress.on(() => log("Button Pressed (using 'OnPress' event)"));

  const b2 = new Gwen.Button(p);
  b2.setText('Замежная мова');
  b2.setBounds(220, 60, 150, 22);

  const b3 = new Gwen.Button(p);
  b3.setText('Image Button');
  b3.setBounds(220, 90, 150, 22);
  b3.setImageTexture(smileyTexture, 16, 16);

  // Standalone icon-only button — sized to fit the 16×16 smiley plus padding.
  const b3icon = new Gwen.Button(p);
  b3icon.setText('');
  b3icon.setBounds(220, 120, 28, 22);
  b3icon.setImageTexture(smileyTexture, 16, 16, true);

  const b4 = new Gwen.Button(p);
  b4.setText('Toggle Me');
  b4.setBounds(220, 155, 150, 22);
  b4.setIsToggle(true);
  b4.onToggleOn.on(() => log('Toggle is ON'));
  b4.onToggleOff.on(() => log('Toggle is OFF'));

  const b5 = new Gwen.Button(p);
  b5.setText('Disabled :D');
  b5.setBounds(220, 185, 150, 22);
  b5.setDisabled(true);

  const b6 = new Gwen.Button(p);
  b6.setText('With Tooltip');
  b6.setBounds(220, 215, 150, 22);
  b6.setToolTip('This is a tooltip');

  const bigBtn = new Gwen.Button(p);
  bigBtn.setText('Event Tester');
  bigBtn.setBounds(500, 30, 300, 220);
  bigBtn.onPress.on(() => log('Event Tester Pressed'));
});

addDemo(basicCat, 'Label', (p) => {
  const titles = ['Default', 'Bright', 'Dark', 'Highlight'];
  const configs: Array<(l: Gwen.Label) => void> = [
    (l) => l.makeColorNormal(),
    (l) => l.makeColorBright(),
    (l) => l.makeColorDark(),
    (l) => l.makeColorHighlight(),
  ];
  for (let i = 0; i < titles.length; i++) {
    const l = new Gwen.Label(p);
    l.setText(`${titles[i]} Label`);
    l.setBounds(20, 20 + i * 22, 240, 20);
    configs[i](l);
  }

  const clickable = new Gwen.LabelClickable(p);
  clickable.setText('A clickable label (hyperlink-style)');
  clickable.setBounds(20, 140, 300, 20);
  clickable.onPress.on(() => log('Hyperlink clicked'));

  const alignH: Array<[number, string]> = [
    [Gwen.Pos.Top | Gwen.Pos.Left, 'Top-Left'],
    [Gwen.Pos.Top | Gwen.Pos.CenterH, 'Top-Center'],
    [Gwen.Pos.Top | Gwen.Pos.Right, 'Top-Right'],
    [Gwen.Pos.CenterV | Gwen.Pos.Left, 'Center-Left'],
    [Gwen.Pos.Center, 'Center'],
    [Gwen.Pos.CenterV | Gwen.Pos.Right, 'Center-Right'],
    [Gwen.Pos.Bottom | Gwen.Pos.Left, 'Bottom-Left'],
    [Gwen.Pos.Bottom | Gwen.Pos.CenterH, 'Bottom-Center'],
    [Gwen.Pos.Bottom | Gwen.Pos.Right, 'Bottom-Right'],
  ];
  for (let i = 0; i < alignH.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const l = new Gwen.Label(p);
    l.setAlignment(alignH[i][0]);
    l.setText(alignH[i][1]);
    l.setBounds(380 + col * 110, 20 + row * 60, 100, 55);
    l.setShouldDrawBackground(true);
  }
});

addDemo(basicCat, 'LabelMultiline', (p) => {
  const colA = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum at lobortis nulla, ac feugiat dolor. Suspendisse potenti.',
    'Phasellus dignissim, lectus at varius cursus, mi mauris egestas mauris, ac consectetur ipsum risus quis eros. Curabitur lacinia eros nec orci posuere, sed varius mi venenatis. Donec a turpis quis arcu interdum tristique. Praesent vehicula odio nec arcu volutpat, in tincidunt urna porttitor. Suspendisse hendrerit augue eu lectus laoreet, in vehicula ipsum cursus.',
  ];
  const colB = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ultrices pharetra scelerisque. Ut posuere velit a ligula suscipit ut lobortis ligula congue. Aliquam lacinia cursus est, quis aliquam nisl scelerisque vitae. Nunc porta vitae libero ac, non rhoncus eros. Integer elementum, quam vitae egestas dictum, mi quam gravida feugiat, non fringilla lacus nisi sit amet nunc. Maecenas dolor tellus, consequat sed sodales ut, aliquam ac enim. Nulla facilisi. Maecenas eleifend, velit a lobortis vehicula, nunc lacus egestas leo, volutpat egestas augue nulla nec turpis. Aenean convallis diam magna. Duis ac lacinia massa.',
  ];
  const colC = [
    'Nullam vel risus eget lacus consectetur rutrum. Curabitur eros libero, porta sed commodo vel, euismod non quam. Fusce bibendum posuere metus, nec mollis odio rutrum ac. Cras nec sapien et mauris dapibus pretium id quis dolor. Sed a velit vel tellus viverra sodales. Praesent tempor purus et elit ultrices tristique. In enim enim nec elit molestie fermentum et quis enim. Nullam varius placerat lacus nec ultrices. Aliquam erat volutpat. Suspendisse potenti. Nullam euismod pulvinar luctus. Vestibulum vel dui nisi, eget tempus est. Vivamus molestie arcu non enim pulvinar sollicitudin. Pellentesque dapibus risus sit amet diam tempor faucibus accumsan ante porta. Phasellus quis facilisis quam. Fusce eget adipiscing magna.',
  ];

  const colW = 250;
  const x0 = 10;
  const gap = 14;

  const a = new Gwen.RichLabel(p);
  a.setBounds(x0, 10, colW, 300);
  for (const para of colA) {
    a.addText(para);
    a.addLineBreak();
    a.addLineBreak();
  }

  const b = new Gwen.RichLabel(p);
  b.setBounds(x0 + colW + gap, 10, colW, 300);
  for (const para of colB) {
    b.addText(para);
  }

  const c = new Gwen.RichLabel(p);
  c.setBounds(x0 + 2 * (colW + gap), 10, colW, 300);
  for (const para of colC) {
    c.addText(para);
  }
});

// ---------------------------------------------------------------------------
// NON-INTERACTIVE category
// ---------------------------------------------------------------------------

const nonInteractiveCat = catList.add('Non-Interactive');

addDemo(nonInteractiveCat, 'ProgressBar', (p) => {
  // 3 vertical bars on the left (matching reference: 25%, 40%, 65%).
  const v1 = new Gwen.ProgressBar(p);
  v1.setBounds(150, 20, 30, 200);
  v1.setVertical();
  v1.setProgress(0.25);

  const v2 = new Gwen.ProgressBar(p);
  v2.setBounds(190, 20, 30, 200);
  v2.setVertical();
  v2.setProgress(0.40);

  const v3 = new Gwen.ProgressBar(p);
  v3.setBounds(230, 20, 30, 200);
  v3.setVertical();
  v3.setProgress(0.88);

  // 7 horizontal bars on the right (matching reference layout/percentages).
  const hSpec: Array<{ p: number; label?: string; blank?: boolean }> = [
    { p: 0.27 },
    { p: 0.66 },
    { p: 0.88 },
    { p: 0.42, label: '40,245 MB' },
    { p: 0.55, blank: true },
    { p: 0.0, blank: true },
    { p: 0.65 },
  ];
  for (let i = 0; i < hSpec.length; i++) {
    const h = new Gwen.ProgressBar(p);
    h.setBounds(290, 20 + i * 28, 280, 22);
    if (hSpec[i].label || hSpec[i].blank) h.setAutoLabel(false);
    h.setProgress(hSpec[i].p);
    if (hSpec[i].label) h.setText(hSpec[i].label!);
    else if (hSpec[i].blank) h.setText('');
  }
});

addDemo(nonInteractiveCat, 'GroupBox', (p) => {
  const gb = new Gwen.GroupBox(p);
  gb.setBounds(20, 20, 280, 200);
  gb.setText('Group Title');

  const cb = new Gwen.CheckBoxWithLabel(gb.getInnerPanel());
  cb.setPos(10, 10);
  cb.getLabel().setText('Option 1');

  const cb2 = new Gwen.CheckBoxWithLabel(gb.getInnerPanel());
  cb2.setPos(10, 35);
  cb2.getLabel().setText('Option 2');

  const btn = new Gwen.Button(gb.getInnerPanel());
  btn.setPos(10, 80);
  btn.setSize(100, 22);
  btn.setText('Action');

  const nested = new Gwen.GroupBox(p);
  nested.setBounds(320, 20, 240, 180);
  nested.setText('Another Group');
});

addDemo(nonInteractiveCat, 'ImagePanel', (p) => {
  const logo = new Gwen.ImagePanel(p);
  logo.setBounds(220, 80, 96, 96);
  logo.setTexture(gwenLogoTexture);

  const redBlock = new Gwen.ColorDisplay(p);
  redBlock.setColor(Gwen.color(255, 0, 0, 255));
  redBlock.setBounds(330, 80, 96, 96);

  // Custom-image slot — populated by the FilePicker below. Starts blank
  // (a 96×96 outline rectangle) until the user picks an image file.
  const customFrame = new Gwen.Rectangle(p);
  customFrame.setBounds(440, 80, 96, 96);
  customFrame.setColor(Gwen.color(80, 80, 80, 255));

  const customPanel = new Gwen.ImagePanel(p);
  customPanel.setBounds(440, 80, 96, 96);

  const hint = new Gwen.Label(p);
  hint.setText('Load a custom image:');
  hint.setBounds(220, 200, 200, 18);

  const picker = new Gwen.FilePicker(p);
  picker.setBounds(220, 222, 316, 22);
  picker.setAccept('image/*');

  picker.onFileChanged.on(() => {
    const f = picker.getFile();
    if (!f) {
      // Clearing the picker resets the slot to its blank state. The
      // empty Texture (width=height=0) renders as nothing; the frame
      // rectangle behind it shows through.
      customPanel.setTexture(Gwen.texture());
      log('ImagePanel: cleared custom image');
      return;
    }
    const url = URL.createObjectURL(f);
    Gwen.ImagePanel.loadFromURL(url, renderer)
      .then((tex) => {
        customPanel.setTexture(tex);
        log(`ImagePanel: loaded ${f.name} (${tex.width}×${tex.height})`);
      })
      .catch((err: Error) => {
        log(`ImagePanel: failed to load ${f.name} — ${err.message}`);
      })
      .finally(() => URL.revokeObjectURL(url));
  });
});

addDemo(nonInteractiveCat, 'StatusBar', (p) => {
  const info = new Gwen.Label(p);
  info.setText('A StatusBar is docked at the very bottom of this window.');
  info.setBounds(20, 20, 500, 20);

  const demoBar = new Gwen.StatusBar(p);
  demoBar.dock(Gwen.Pos.Bottom);
  demoBar.setText('Demo status bar — 42 items');
});

// ---------------------------------------------------------------------------
// CONTROLS category
// ---------------------------------------------------------------------------

const controlsCat = catList.add('Controls');

addDemo(controlsCat, 'ComboBox', (p) => {
  const cb = new Gwen.ComboBox(p);
  cb.setBounds(20, 20, 200, 22);
  for (const n of ['One', 'Two', 'Three', 'Four', 'Five']) cb.addItem(n, n.toLowerCase());
  cb.onSelection.on(() => log(`ComboBox selection: ${cb.getSelectedItem()?.getText() ?? ''}`));

  const wide = new Gwen.ComboBox(p);
  wide.setBounds(20, 55, 300, 22);
  for (const n of ['Small', 'Medium', 'Large', 'Extra Large']) wide.addItem(n);
});

addDemo(controlsCat, 'TextBox', (p) => {
  const tb = new Gwen.TextBox(p);
  tb.setBounds(20, 20, 300, 20);
  tb.setText('Type here...');
  tb.onTextChange.on(() => log(`TextBox: ${tb.getText()}`));

  const pw = new Gwen.PasswordTextBox(p);
  pw.setBounds(20, 50, 300, 20);
  pw.setText('s3cret');

  const multi = new Gwen.TextBoxMultiline(p);
  multi.setBounds(20, 80, 400, 140);
  multi.setText('Multi-line text box.\nSecond line.\nThird line.');
});

addDemo(controlsCat, 'ListBox', (p) => {
  const lb = new Gwen.ListBox(p);
  lb.setBounds(20, 20, 200, 200);
  for (const n of ['Red', 'Green', 'Blue', 'Yellow', 'Cyan', 'Magenta', 'White', 'Black', 'Purple', 'Orange']) {
    lb.addItem(n, n.toLowerCase());
  }
  lb.onRowSelected.on(() => {
    const sel = lb.getSelectedRow();
    log(`Listbox Item Selected: ${sel?.getText() ?? ''}`);
  });

  const lbMulti = new Gwen.ListBox(p);
  lbMulti.setBounds(240, 20, 200, 200);
  lbMulti.setAllowMultiSelect(true);
  for (const n of ['Apples', 'Bananas', 'Cherries', 'Dates', 'Elderberries', 'Figs', 'Grapes']) {
    lbMulti.addItem(n);
  }
});

addDemo(controlsCat, 'CrossSplitter', (p) => {
  const colors = [
    Gwen.color(170, 80, 80, 255),
    Gwen.color(80, 170, 80, 255),
    Gwen.color(80, 80, 170, 255),
    Gwen.color(170, 170, 80, 255),
  ];

  // Stage hosts whichever splitter the combo currently selects. Rebuilding
  // disposes the previous splitter subtree so we don't leak panels.
  const stage = new Gwen.Base(p);
  stage.setBounds(10, 10, 500, 300);

  let active: Gwen.Base | null = null;

  const rebuild = (mode: string): void => {
    if (active) {
      active.dispose();
      active = null;
    }
    if (mode === 'cross') {
      const sp = new Gwen.CrossSplitter(stage);
      sp.dock(Gwen.Pos.Fill);
      for (let i = 0; i < 4; i++) {
        const leaf = new Gwen.ColorDisplay(sp);
        leaf.setColor(colors[i]);
        sp.setPanel(i, leaf);
      }
      active = sp;
    } else if (mode === 'horizontal') {
      // Horizontal split (vertical bar): two panels side-by-side.
      const sp = new Gwen.SplitterHorizontal(stage);
      sp.dock(Gwen.Pos.Fill);
      const a = new Gwen.ColorDisplay(null);
      a.setColor(colors[0]);
      const b = new Gwen.ColorDisplay(null);
      b.setColor(colors[1]);
      sp.setPanels(a, b);
      active = sp;
    } else {
      // Vertical split (horizontal bar): two panels stacked top/bottom.
      const sp = new Gwen.SplitterVertical(stage);
      sp.dock(Gwen.Pos.Fill);
      const a = new Gwen.ColorDisplay(null);
      a.setColor(colors[0]);
      const b = new Gwen.ColorDisplay(null);
      b.setColor(colors[1]);
      sp.setPanels(a, b);
      active = sp;
    }
  };

  rebuild('cross');

  // Mode selector on the right. ComboBox.addItem's first entry becomes
  // the selection without firing onSelection, so the initial 'cross'
  // state we set above matches what the combo shows.
  const group = new Gwen.GroupBox(p);
  group.setBounds(520, 10, 160, 90);
  group.setText('Splitter Mode');

  const combo = new Gwen.ComboBox(group.getInnerPanel() ?? group);
  combo.setBounds(10, 10, 130, 22);
  combo.addItem('Cross', 'cross');
  combo.addItem('Horizontal', 'horizontal');
  combo.addItem('Vertical', 'vertical');
  combo.onSelection.on(() => {
    const sel = combo.getSelectedItem();
    if (sel) rebuild(sel.getName());
  });
});

addDemo(controlsCat, 'RadioButton', (p) => {
  const rbc = new Gwen.RadioButtonController(p);
  rbc.setBounds(20, 20, 220, 150);
  rbc.addOption('Option A', 'A');
  rbc.addOption('Option B', 'B');
  rbc.addOption('Option C', 'C');
  rbc.onSelectionChange.on(() => log(`Radio: ${rbc.getSelectedName()}`));
});

addDemo(controlsCat, 'Checkbox', (p) => {
  const cb1 = new Gwen.CheckBoxWithLabel(p);
  cb1.setPos(20, 20);
  cb1.getLabel().setText('Checkbox 1');
  cb1.getCheckBox().onCheckChanged.on(() => log('Checkbox 1 changed'));

  const cb2 = new Gwen.CheckBoxWithLabel(p);
  cb2.setPos(20, 45);
  cb2.getLabel().setText('Checkbox 2');

  const cb3 = new Gwen.CheckBoxWithLabel(p);
  cb3.setPos(20, 70);
  cb3.getLabel().setText('Checkbox 3');
  cb3.getCheckBox().setChecked(true);
});

addDemo(controlsCat, 'Numeric', (p) => {
  const num = new Gwen.NumericUpDown(p);
  num.setBounds(20, 20, 100, 22);
  num.setMin(0);
  num.setMax(100);
  num.setIntValue(42);
  num.onChange.on(() => log(`Numeric: ${num.getIntValue()}`));

  const num2 = new Gwen.NumericUpDown(p);
  num2.setBounds(20, 50, 120, 22);
  num2.setMin(-50);
  num2.setMax(50);
  num2.setIntValue(0);
});

addDemo(controlsCat, 'Slider', (p) => {
  const hs = new Gwen.HorizontalSlider(p);
  hs.setBounds(20, 20, 300, 22);
  hs.setRange(0, 100);
  hs.setFloatValue(50);
  hs.onValueChanged.on(() => log(`Slider: ${Math.round(hs.getFloatValue())}`));

  const hs2 = new Gwen.HorizontalSlider(p);
  hs2.setBounds(20, 55, 300, 22);
  hs2.setRange(0, 10);
  hs2.setFloatValue(3);
  hs2.setNotchCount(10);
  hs2.setClampToNotches(true);

  const vs = new Gwen.VerticalSlider(p);
  vs.setBounds(340, 20, 22, 180);
  vs.setRange(0, 100);
  vs.setFloatValue(25);

  const vs2 = new Gwen.VerticalSlider(p);
  vs2.setBounds(380, 20, 22, 180);
  vs2.setRange(0, 100);
  vs2.setFloatValue(75);
});

addDemo(controlsCat, 'MenuStrip', (p) => {
  const info = new Gwen.Label(p);
  info.setText('The application menu bar at the top of this window IS the MenuStrip.');
  info.setBounds(20, 20, 500, 20);
  info.setAlignment(Gwen.Pos.Left | Gwen.Pos.CenterV);

  const more = new Gwen.Label(p);
  more.setText("Click any of File / Edit / Help to see it in action.");
  more.setBounds(20, 45, 500, 20);
});

// ---------------------------------------------------------------------------
// CONTAINERS category
// ---------------------------------------------------------------------------

const containersCat = catList.add('Containers');

addDemo(containersCat, 'Window', (p) => {
  // Centring column for the action buttons. The demo panel's width
  // isn't known at construction time (centerPanel is itself dock-
  // Filled), so a hardcoded x leaves the buttons stuck to whatever
  // the first-frame layout happened to compute. The custom postLayout
  // re-centres every child on each pass; siblings outside this
  // column (the WindowControl below) keep their own positions.
  //
  // Created BEFORE the pre-opened window so the column ends up
  // earlier in `p._children` — z-order is array order (later =
  // on top), so the WindowControl renders + hit-tests above the
  // column rather than being buried under a Pos.Fill panel that
  // would otherwise eat every click on the title bar.
  class CenteredColumn extends Gwen.Base {
    override postLayout(skin: Gwen.Skin): void {
      super.postLayout(skin);
      const w = this.width();
      for (const c of this.children) {
        c.setPos(Math.round((w - c.width()) / 2), c.y());
      }
    }
  }

  const column = new CenteredColumn(p);
  column.dock(Gwen.Pos.Fill);
  // Don't draw — this is a layout-only container.
  column.setShouldDrawBackground(false);

  // Pre-opened "Window 1" — matches the reference layout (visible
  // immediately when the Window demo is selected). Floats freely;
  // not affected by the centering column above.
  const preOpened = new Gwen.WindowControl(p, 'Window 1');
  preOpened.setBounds(80, 60, 240, 240);

  const normalBtn = new Gwen.Button(column);
  normalBtn.setBounds(0, 120, 160, 22);
  normalBtn.setText('Normal Window');
  normalBtn.onPress.on(() => {
    const w = new Gwen.WindowControl(canvas, 'Window');
    w.setBounds(200, 150, 280, 180);
    const l = new Gwen.Label(w);
    l.setText('This is a floating window.');
    l.setBounds(20, 40, 240, 20);
    const ok = new Gwen.Button(w);
    ok.setText('OK');
    ok.setBounds(180, 130, 80, 22);
    ok.onPress.on(() => w.close());
  });

  const modalBtn = new Gwen.Button(column);
  modalBtn.setBounds(0, 150, 160, 22);
  modalBtn.setText('Modal Window');
  modalBtn.onPress.on(() => {
    const w = new Gwen.WindowControl(canvas, 'Modal');
    w.setBounds(250, 160, 300, 140);
    w.makeModal(true);
    const l = new Gwen.Label(w);
    l.setText('Click OK to dismiss.');
    l.setBounds(20, 40, 260, 20);
    const ok = new Gwen.Button(w);
    ok.setText('OK');
    ok.setBounds(200, 90, 80, 22);
    ok.onPress.on(() => w.close());
  });
});

addDemo(containersCat, 'TreeControl', (p) => {
  const t = new Gwen.TreeControl(p);
  t.setBounds(20, 20, 250, 260);
  const root = t.addNode('Node One');
  const nt = t.addNode('Node Two');
  const n2i = nt.addNode('Node Two Inside');
  nt.addNode('Eyes');
  const brown = nt.addNode('Brown');
  const n2i2 = brown.addNode('Node Two Inside');
  n2i2.addNode('Eyes');
  n2i2.addNode('Brown');
  nt.addNode('More');
  nt.addNode('Nodes');
  t.addNode('Node Three');
  // Extra top-level nodes + some nested children so the tree
  // overflows the 260px-tall TreeControl when expanded — gives the
  // ScrollControl's vertical bar real content to scroll through.
  for (let i = 1; i <= 7; i++) {
    const branch = t.addNode(`Branch ${i}`);
    branch.addNode(`${i}.a — leaf`);
    branch.addNode(`${i}.b — leaf`);
    if (i % 3 === 0) {
      const sub = branch.addNode(`${i}.c — sub-branch`);
      sub.addNode('deep leaf 1');
      sub.addNode('deep leaf 2');
    }
  }
  root.open();
  nt.open();
  brown.open();
  n2i2.open();
  root.onSelectChange.on(() => log('Tree selection changed'));

  // Second tree without open nodes for variety.
  const t2 = new Gwen.TreeControl(p);
  t2.setBounds(290, 20, 250, 260);
  const r2 = t2.addNode('Node One');
  const nt2 = t2.addNode('Node Two');
  nt2.addNode('Node Two Inside');
  nt2.addNode('Eyes');
  const br2 = nt2.addNode('Brown');
  const ni2 = br2.addNode('Node Two Inside');
  ni2.addNode('Eyes');
  nt2.addNode('More');
  nt2.addNode('Nodes');
  void r2;
});

addDemo(containersCat, 'Properties', (p) => {
  // Mirrors GWEN UnitTest/Properties.cpp: a flat Properties grid on the
  // left, a collapsible PropertyTree with rich editors (checkbox, color
  // picker, combobox) on the right. ExpandAll opens both groups so the
  // editors are visible without clicking the toggle.
  const props = new Gwen.Properties(p);
  props.setBounds(10, 10, 150, 300);
  const firstNameRow = props.add('First Name');
  firstNameRow.onChange.on(() => {
    const prop = firstNameRow.getProperty();
    if (prop) log(`First Name Changed: ${prop.getPropertyValue()}`);
  });
  props.add('Middle Name');
  props.add('Last Name');

  const tree = new Gwen.PropertyTree(p);
  tree.setBounds(200, 10, 260, 320);
  // Reusable helper — widen the label column so labels like
  // "ColorSelector" (~95px at default font) don't clip. Run this
  // after `tree.add()` so it picks up the freshly-created Properties.
  const widenLabels = (g: Gwen.Properties) => g.getSplitter().setPos(110, 0);
  {
    const item = tree.add('Item One');
    widenLabels(item);
    item.add('Middle Name');
    item.add('Last Name');
    item.add('Four');
  }
  {
    const item = tree.add('Item Two');
    widenLabels(item);
    item.add('More Items');
    item.addRow('Checkbox', new Gwen.PropertyCheckbox(item), '1');
    item.add('To Fill');
    item.addRow('ColorSelector', new Gwen.PropertyColorSelector(item), '255 0 0');
    item.add('Out Here');
    const numeric = new Gwen.PropertyNumeric(item);
    numeric.getNumericUpDown().setMin(0);
    numeric.getNumericUpDown().setMax(100);
    item.addRow('Stepper', numeric, '42');
    const combo = new Gwen.PropertyComboBox(item);
    const cb = combo.getComboBox();
    cb.addItem('Option One', 'one');
    cb.addItem('Number Two', 'two');
    cb.addItem('Door Three', 'three');
    cb.addItem('Four Legs', 'four');
    cb.addItem('Five Birds', 'five');
    const comboRow = item.addRow('ComboBox', combo, 'one');
    comboRow.onChange.on(() => log(`ComboBox: ${combo.getPropertyValue()}`));

    const fileProp = new Gwen.PropertyFile(item);
    const fileRow = item.addRow('File', fileProp);
    fileRow.onChange.on(() => {
      const f = fileProp.getFile();
      log(`File: ${f ? `${f.name} (${f.size} bytes)` : '(cleared)'}`);
    });
  }
  {
    // Item Three — deliberately tall enough that expanding it pushes
    // the tree's content past the 320px viewport, exercising the
    // ScrollControl's vertical bar.
    const item = tree.add('Item Three');
    widenLabels(item);
    for (let i = 1; i <= 12; i++) item.add(`Extra Field ${i}`, `value-${i}`);
  }
  tree.expandAll();
});

addDemo(containersCat, 'TabControl', (p) => {
  const tc = new Gwen.TabControl(p);
  tc.setBounds(20, 20, 500, 300);
  for (const name of ['Controls', 'Textures', 'Lighting', 'Physics']) {
    const tab = tc.addPage(name);
    const page = tab.getPage();
    if (!page) continue;
    const l = new Gwen.Label(page);
    l.setText(`This is the "${name}" page.`);
    l.setBounds(20, 20, 300, 20);
  }
});

addDemo(containersCat, 'ActionBar', (p) => {
  // Procedurally-drawn tool icons — keeps the demo asset-free.
  const makeIcon = (paint: (g: CanvasRenderingContext2D) => void): Gwen.Texture => {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 20;
    const g = c.getContext('2d')!;
    g.lineWidth = 1.6;
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    paint(g);
    const tex = Gwen.texture('actionbar-icon');
    renderer.loadTextureFromSource(tex, c);
    return tex;
  };
  const addIconButton = (bar: Gwen.ActionBar, icon: Gwen.Texture): Gwen.ActionBarButton =>
    registerThemedIconButton(bar.addButton('', icon));

  const moveIcon = makeIcon((g) => {
    // 4-arrow cross
    g.beginPath();
    g.moveTo(10, 2); g.lineTo(10, 18);
    g.moveTo(2, 10); g.lineTo(18, 10);
    g.stroke();
    // arrowheads
    g.beginPath();
    g.moveTo(10, 2); g.lineTo(7, 5); g.moveTo(10, 2); g.lineTo(13, 5);
    g.moveTo(10, 18); g.lineTo(7, 15); g.moveTo(10, 18); g.lineTo(13, 15);
    g.moveTo(2, 10); g.lineTo(5, 7); g.moveTo(2, 10); g.lineTo(5, 13);
    g.moveTo(18, 10); g.lineTo(15, 7); g.moveTo(18, 10); g.lineTo(15, 13);
    g.stroke();
  });
  const brushIcon = makeIcon((g) => {
    // Brush stroke + handle
    g.beginPath();
    g.moveTo(3, 17); g.lineTo(11, 9);
    g.lineWidth = 3;
    g.stroke();
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(11, 9); g.lineTo(17, 3);
    g.stroke();
  });
  const eraseIcon = makeIcon((g) => {
    g.strokeRect(4, 6, 12, 8);
    g.beginPath();
    g.moveTo(7, 6); g.lineTo(7, 14);
    g.moveTo(13, 6); g.lineTo(13, 14);
    g.stroke();
  });
  const textIcon = makeIcon((g) => {
    g.font = 'bold 16px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('A', 10, 11);
  });
  const boldIcon = makeIcon((g) => {
    g.font = 'bold 14px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('B', 10, 11);
  });
  const italicIcon = makeIcon((g) => {
    g.font = 'italic 14px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('I', 10, 11);
  });
  const underlineIcon = makeIcon((g) => {
    g.font = '14px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('U', 10, 9);
    g.beginPath();
    g.moveTo(6, 16); g.lineTo(14, 16);
    g.stroke();
  });

  // Six more icons for the wider Photoshop-style palette.
  const lassoIcon = makeIcon((g) => {
    g.beginPath();
    g.moveTo(4, 14);
    g.bezierCurveTo(2, 6, 10, 2, 14, 6);
    g.bezierCurveTo(18, 10, 14, 16, 8, 16);
    g.lineTo(6, 18);
    g.stroke();
  });
  const cropIcon = makeIcon((g) => {
    g.beginPath();
    g.moveTo(5, 2); g.lineTo(5, 16); g.lineTo(18, 16);
    g.moveTo(2, 5); g.lineTo(15, 5); g.lineTo(15, 18);
    g.stroke();
  });
  const fillIcon = makeIcon((g) => {
    g.beginPath();
    g.moveTo(6, 5); g.lineTo(15, 14);
    g.lineTo(11, 18); g.lineTo(2, 9); g.closePath();
    g.fill();
    g.beginPath();
    g.arc(17, 8, 2, 0, Math.PI * 2);
    g.fill();
  });
  const shapeIcon = makeIcon((g) => {
    g.strokeRect(3, 3, 8, 8);
    g.beginPath();
    g.arc(14, 14, 4, 0, Math.PI * 2);
    g.stroke();
  });
  const eyedropperIcon = makeIcon((g) => {
    g.beginPath();
    g.moveTo(3, 17); g.lineTo(11, 9);
    g.moveTo(11, 9); g.lineTo(13, 7); g.lineTo(15, 9); g.lineTo(13, 11);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
    g.beginPath();
    g.moveTo(13, 11); g.lineTo(17, 7);
    g.lineWidth = 2;
    g.stroke();
  });
  const handIcon = makeIcon((g) => {
    g.beginPath();
    g.moveTo(5, 16); g.lineTo(5, 9);
    g.lineTo(7, 9); g.lineTo(7, 5);
    g.lineTo(9, 5); g.lineTo(9, 9);
    g.lineTo(11, 9); g.lineTo(11, 6);
    g.lineTo(13, 6); g.lineTo(13, 10);
    g.lineTo(15, 10); g.lineTo(15, 13);
    g.lineTo(13, 17); g.lineTo(7, 17); g.closePath();
    g.stroke();
  });

  // ── Vertical single-column "tool palette" on the left, like Photoshop ──
  // Radio mode keeps exactly one tool selected at a time.
  const tools = new Gwen.ActionBar(p);
  tools.setVertical(true);
  tools.setBounds(20, 60, 32, 220);
  tools.setRadioMode(true);

  const move = addIconButton(tools, moveIcon);
  move.setToolTip('Move');
  move.setToggleState(true);              // initial active tool
  move.onPress.on(() => log('Tool: Move'));
  const brush = addIconButton(tools, brushIcon);
  brush.setToolTip('Brush');
  brush.onPress.on(() => log('Tool: Brush'));
  const erase = addIconButton(tools, eraseIcon);
  erase.setToolTip('Eraser');
  erase.onPress.on(() => log('Tool: Eraser'));
  tools.addSeparator();
  const text = addIconButton(tools, textIcon);
  text.setToolTip('Text');
  text.onPress.on(() => log('Tool: Text'));

  // ── Vertical two-column palette right next to it ───────────────────
  const tools2 = new Gwen.ActionBar(p);
  tools2.setVertical(true);
  tools2.setColumns(2);
  tools2.setBounds(60, 60, 60, 220);
  tools2.setRadioMode(true);
  const t2Move = addIconButton(tools2, moveIcon);
  t2Move.setToolTip('Move');
  t2Move.setToggleState(true);
  t2Move.onPress.on(() => log('Palette2: Move'));
  const t2Lasso = addIconButton(tools2, lassoIcon);
  t2Lasso.setToolTip('Lasso');
  t2Lasso.onPress.on(() => log('Palette2: Lasso'));
  const t2Crop = addIconButton(tools2, cropIcon);
  t2Crop.setToolTip('Crop');
  t2Crop.onPress.on(() => log('Palette2: Crop'));
  const t2Eyedrop = addIconButton(tools2, eyedropperIcon);
  t2Eyedrop.setToolTip('Eyedropper');
  t2Eyedrop.onPress.on(() => log('Palette2: Eyedropper'));
  tools2.addSeparator();
  const t2Brush = addIconButton(tools2, brushIcon);
  t2Brush.setToolTip('Brush');
  t2Brush.onPress.on(() => log('Palette2: Brush'));
  const t2Fill = addIconButton(tools2, fillIcon);
  t2Fill.setToolTip('Fill');
  t2Fill.onPress.on(() => log('Palette2: Fill'));
  const t2Erase = addIconButton(tools2, eraseIcon);
  t2Erase.setToolTip('Eraser');
  t2Erase.onPress.on(() => log('Palette2: Eraser'));
  const t2Shape = addIconButton(tools2, shapeIcon);
  t2Shape.setToolTip('Shape');
  t2Shape.onPress.on(() => log('Palette2: Shape'));
  tools2.addSeparator();
  const t2Text = addIconButton(tools2, textIcon);
  t2Text.setToolTip('Text');
  t2Text.onPress.on(() => log('Palette2: Text'));
  const t2Hand = addIconButton(tools2, handIcon);
  t2Hand.setToolTip('Hand');
  t2Hand.onPress.on(() => log('Palette2: Hand'));

  // ── Horizontal "quick action" bar on the top, like Word ──────────
  // Bold/Italic/Underline are independent toggles (no radio mode); the
  // dropdown + Undo/Redo round out the bar.
  const quick = new Gwen.ActionBar(p);
  quick.setBounds(130, 20, 440, 32);

  const bold = addIconButton(quick, boldIcon);
  bold.setIsToggle(true);
  bold.setToolTip('Bold');
  bold.onPress.on(() => log(`Bold: ${bold.getToggleState() ? 'on' : 'off'}`));

  const italic = addIconButton(quick, italicIcon);
  italic.setIsToggle(true);
  italic.setToolTip('Italic');
  italic.onPress.on(() => log(`Italic: ${italic.getToggleState() ? 'on' : 'off'}`));

  const underline = addIconButton(quick, underlineIcon);
  underline.setIsToggle(true);
  underline.setToolTip('Underline');
  underline.onPress.on(() => log(`Underline: ${underline.getToggleState() ? 'on' : 'off'}`));

  quick.addSeparator();

  const fontCombo = new Gwen.ComboBox(quick);
  fontCombo.setSize(140, 22);
  for (const f of ['Helvetica', 'Times', 'Courier', 'Comic Sans']) fontCombo.addItem(f, f);
  fontCombo.selectItemByName('Helvetica', false);
  quick.addItem(fontCombo);
  fontCombo.onSelection.on(() => log(`Font: ${fontCombo.getSelectedItem()?.getText()}`));

  quick.addSeparator();

  const undoBtn = quick.addButton('Undo');
  undoBtn.setSize(56, 28);
  undoBtn.onPress.on(() => log('Action: Undo'));
  const redoBtn = quick.addButton('Redo');
  redoBtn.setSize(56, 28);
  redoBtn.onPress.on(() => log('Action: Redo'));

  // ── Section-mode horizontal bar — three sections separated by dividers.
  //   Sec 0 (radio):  alignment buttons — one selected at a time.
  //   Sec 1 (normal): formatting toggles — independent on/off.
  //   Sec 2 (radio):  zoom level — one selected at a time, independent of Sec 0.
  // Demonstrates that radio scoping happens per section, not bar-wide.
  const sectioned = new Gwen.ActionBar(p);
  sectioned.setBounds(130, 110, 440, 32);
  sectioned.setSectionMode(true);

  // Section 0 — alignment (radio).
  sectioned.beginSection({ radio: true });
  const alignLeft = registerThemedIconButton(sectioned.addButton('L'));
  alignLeft.setToolTip('Align Left');
  alignLeft.setToggleState(true);
  alignLeft.onPress.on(() => log('Align: Left'));
  const alignCenter = registerThemedIconButton(sectioned.addButton('C'));
  alignCenter.setToolTip('Align Center');
  alignCenter.onPress.on(() => log('Align: Center'));
  const alignRight = registerThemedIconButton(sectioned.addButton('R'));
  alignRight.setToolTip('Align Right');
  alignRight.onPress.on(() => log('Align: Right'));

  // Section 1 — formatting (normal: each toggle is independent).
  sectioned.beginSection({ radio: false });
  const secBold = registerThemedIconButton(sectioned.addButton('', boldIcon));
  secBold.setIsToggle(true);
  secBold.setToolTip('Bold');
  secBold.onPress.on(() => log(`Sec-Bold: ${secBold.getToggleState() ? 'on' : 'off'}`));
  const secItalic = registerThemedIconButton(sectioned.addButton('', italicIcon));
  secItalic.setIsToggle(true);
  secItalic.setToolTip('Italic');
  secItalic.onPress.on(() => log(`Sec-Italic: ${secItalic.getToggleState() ? 'on' : 'off'}`));
  const secUnder = registerThemedIconButton(sectioned.addButton('', underlineIcon));
  secUnder.setIsToggle(true);
  secUnder.setToolTip('Underline');
  secUnder.onPress.on(() => log(`Sec-Underline: ${secUnder.getToggleState() ? 'on' : 'off'}`));

  // Section 2 — zoom (radio, independent of Section 0).
  sectioned.beginSection({ radio: true });
  const zoomFit = registerThemedIconButton(sectioned.addButton('Fit'));
  zoomFit.setSize(40, 28);
  zoomFit.setToolTip('Fit');
  zoomFit.setToggleState(true);
  zoomFit.onPress.on(() => log('Zoom: Fit'));
  const zoom100 = registerThemedIconButton(sectioned.addButton('100'));
  zoom100.setSize(40, 28);
  zoom100.setToolTip('100%');
  zoom100.onPress.on(() => log('Zoom: 100%'));
  const zoom200 = registerThemedIconButton(sectioned.addButton('200'));
  zoom200.setSize(40, 28);
  zoom200.setToolTip('200%');
  zoom200.onPress.on(() => log('Zoom: 200%'));

  // Caption beside the canvas area so the user knows what the demo is about.
  const note = new Gwen.Label(p);
  note.setText('Single-column palette ↙   Two-column palette ↙   Horizontal quick-action bar ↑');
  note.setBounds(130, 60, 480, 18);
  const note2 = new Gwen.Label(p);
  note2.setText('Both palettes are in radio mode — only one tool active at a time.');
  note2.setBounds(130, 78, 480, 18);
  const note3 = new Gwen.Label(p);
  note3.setText('Section-mode bar ↓: [align L/C/R radio] · [bold/italic/underline toggles] · [zoom radio]');
  note3.setBounds(130, 96, 540, 18);
});

addDemo(containersCat, 'ScrollControl', (p) => {
  const sc = new Gwen.ScrollControl(p);
  sc.setBounds(20, 20, 300, 200);
  // Two-column grid wider than the viewport so BOTH scrollbars get
  // exercised. Column width 200 + 20px gap → 420 total, comfortably
  // overflowing the 300-wide control. 15 rows of 24px → 360 tall,
  // overflowing the 200-tall control too.
  for (let i = 0; i < 30; i++) {
    const b = new Gwen.Button(sc);
    b.setText(`Button #${i + 1}`);
    const col = i % 2;
    const row = Math.floor(i / 2);
    b.setBounds(10 + col * 220, 10 + row * 24, 200, 22);
  }
});

addDemo(containersCat, 'PageControl', (p) => {
  // Mirrors the GWEN UnitTest/PageControl demo: each page shows off a
  // different layout idiom so flipping through Back/Next produces
  // visibly different content. Selection events route to the Output
  // log so the user can verify Back/Next/Finish wiring.
  const pc = new Gwen.PageControl(p);
  pc.setBounds(20, 20, 500, 300);
  pc.setPageCount(5);
  // useFinish: turn the Next button on the last page into a Finish
  // button instead of hiding it. The on-page-5 prompt now actually
  // wires up a clickable Finish.
  pc.setUseFinishButton(true);
  pc.onPageChanged.on((e) => log(`PageControl: page ${e.integer}`));
  pc.onFinish.on(() => log('PageControl: Finish pressed'));

  // Page 0 — Fill-docked button.
  {
    const page = pc.getPage(0);
    if (page) {
      const b = new Gwen.Button(page);
      b.dock(Gwen.Pos.Fill);
      b.setText('This button is fill docked on page 0');
    }
  }
  // Page 1 — Top-docked button (leaves the rest of the page blank).
  {
    const page = pc.getPage(1);
    if (page) {
      const b = new Gwen.Button(page);
      b.dock(Gwen.Pos.Top);
      b.setText('This button is top docked on page 1');
    }
  }
  // Page 2 — oversized button to demonstrate clipping (matches GWEN's
  // "test scrolling" page; PageControl's page area doesn't auto-add
  // a scroll wrapper, so this just confirms clipping behaviour).
  {
    const page = pc.getPage(2);
    if (page) {
      const b = new Gwen.Button(page);
      b.setSize(400, 1000);
      b.setPos(50, 50);
      b.setText('This button is long to test scrolling (page 2)');
    }
  }
  // Page 3 — a small form (mix of controls per a typical wizard step).
  {
    const page = pc.getPage(3);
    if (page) {
      const l = new Gwen.Label(page);
      l.setText('Page 3 — pick a colour:');
      l.setBounds(20, 20, 300, 20);
      const cb = new Gwen.ComboBox(page);
      cb.setBounds(20, 50, 200, 22);
      cb.addItem('Red');
      cb.addItem('Green');
      cb.addItem('Blue');
      const chk = new Gwen.CheckBoxWithLabel(page);
      chk.setBounds(20, 90, 200, 20);
      chk.getLabel().setText('Subscribe to newsletter');
    }
  }
  // Page 4 — confirmation page; Finish lands here.
  {
    const page = pc.getPage(4);
    if (page) {
      const l = new Gwen.Label(page);
      l.setText('Page 4 of 5 — press Finish to complete the wizard.');
      l.setBounds(20, 20, 460, 20);
      const note = new Gwen.Label(page);
      note.setText('(Output log records the finish event.)');
      note.setBounds(20, 50, 460, 20);
    }
  }
});

// ---------------------------------------------------------------------------
// NON-STANDARD category
// ---------------------------------------------------------------------------

const nonStandardCat = catList.add('Non-Standard');

addDemo(nonStandardCat, 'CollapsibleList', (p) => {
  const cl = new Gwen.CollapsibleList(p);
  cl.setBounds(20, 20, 220, 300);
  const cat1 = cl.add('Animals');
  cat1.add('Dog');
  cat1.add('Cat');
  cat1.add('Bird');
  const cat2 = cl.add('Plants');
  cat2.add('Tree');
  cat2.add('Flower');
  const cat3 = cl.add('Minerals');
  cat3.add('Gold');
  cat3.add('Silver');
  cat3.add('Copper');
});

addDemo(nonStandardCat, 'RightClick', (p) => {
  // Right-click menus bubble from the hovered control up the parent
  // chain; the first control that returns a Menu wins. This demo wires
  // four layers so you can feel each rule:
  //
  //   1. Panel-level "global" — right-click anywhere on the panel
  //      with no override gets these items.
  //   2. A specific button overrides with its own menu.
  //   3. A dynamic menu built on demand via `onContextMenuRequest`.
  //   4. A label that explicitly returns null from its hook to defer
  //      to the panel's "global" — confirms the bubble rule.
  //
  // For an APP-wide menu, replace `p` with `canvas` — same code, just
  // a different attachment point.

  // ── 1. Panel-level "global" ───────────────────────────────────────
  const panelMenu = new Gwen.Menu(canvas);
  panelMenu.addItem('Cut').setAccelerator('Ctrl+X');
  panelMenu.addItem('Copy').setAccelerator('Ctrl+C');
  panelMenu.addItem('Paste').setAccelerator('Ctrl+V');
  panelMenu.addDivider();
  // Submenu — same pattern as the top MenuStrip.
  const panelMore = panelMenu.addItem('More');
  panelMore.getMenu().setShowIconMargin(true);
  panelMore.getMenu().addItem('First');
  panelMore.getMenu().addItem('Second');
  panelMore.getMenu().addItem('Third');
  panelMenu.addDivider();
  panelMenu.addItem('About').onMenuItemSelected.on(() => log('Right-click: About selected'));
  // Wire selections to the demo log.
  for (const name of ['Cut', 'Copy', 'Paste']) {
    panelMenu.getInnerPanel()?.children.forEach((c: Gwen.Base) => {
      if (c instanceof Gwen.MenuItem && c.getText() === name) {
        c.onMenuItemSelected.on(() => log(`Panel menu: ${name}`));
      }
    });
  }
  p.setContextMenu(panelMenu);

  // ── 2. Button with its own custom right-click menu ────────────────
  const btn = new Gwen.Button(p);
  btn.setText('Right-click me (custom)');
  btn.setBounds(20, 20, 220, 28);
  btn.onPress.on(() => log('Button: left-clicked'));

  const btnMenu = new Gwen.Menu(canvas);
  btnMenu.addItem('Run').onMenuItemSelected.on(() => log('Button menu: Run'));
  btnMenu.addItem('Configure...').onMenuItemSelected.on(() => log('Button menu: Configure'));
  btnMenu.addDivider();
  btnMenu.addItem('Disable').onMenuItemSelected.on(() => log('Button menu: Disable'));
  btn.setContextMenu(btnMenu);

  // ── 3. Dynamic menu via onContextMenuRequest ──────────────────────
  const dyn = new Gwen.Label(p);
  dyn.setText('Right-click me (dynamic, includes click position)');
  dyn.setBounds(20, 60, 360, 22);
  // Labels have mouseInputEnabled=false by default — right-clicks pass
  // straight through to the parent. Turn input on so this label
  // actually catches the right-click and the override below fires.
  dyn.setMouseInputEnabled(true);
  // Override per-instance — builds a fresh Menu each time, with an
  // item that reports the click location. Demonstrates the "build on
  // demand" pattern (e.g. for a viewport that wants commands like
  // "Frame here", "Insert at this point", etc.).
  (dyn as unknown as { onContextMenuRequest: (x: number, y: number) => Gwen.Base | null }).onContextMenuRequest = (x: number, y: number) => {
    const m = new Gwen.Menu(canvas);
    m.setDeleteOnClose(true);
    m.addItem(`Clicked at (${x}, ${y})`);
    m.addDivider();
    m.addItem('Action A').onMenuItemSelected.on(() => log(`Dynamic A @ (${x}, ${y})`));
    m.addItem('Action B').onMenuItemSelected.on(() => log(`Dynamic B @ (${x}, ${y})`));
    return m;
  };

  // ── 4. Label that defers to the panel via onContextMenuRequest=null
  const deferred = new Gwen.Label(p);
  deferred.setText('Right-click me (defers to the panel\'s menu)');
  deferred.setBounds(20, 90, 360, 22);
  deferred.setMouseInputEnabled(true);
  (deferred as unknown as { onContextMenuRequest: (x: number, y: number) => Gwen.Base | null }).onContextMenuRequest = () => null;

  // Caption explaining what to do.
  const note = new Gwen.Label(p);
  note.setText('Right-click anywhere on this panel for the panel-level menu.');
  note.setBounds(20, 130, 480, 18);
  const note2 = new Gwen.Label(p);
  note2.setText('Selections log to the Output panel.');
  note2.setBounds(20, 150, 480, 18);
});

addDemo(nonStandardCat, 'ColorPicker', (p) => {
  const cp = new Gwen.ColorPicker(p);
  cp.setBounds(20, 20, 256, 150);
  cp.setColor(Gwen.color(255, 100, 50, 255));

  const hsv = new Gwen.HSVColorPicker(p);
  hsv.setBounds(300, 20, 256, 180);
});

addDemo(nonStandardCat, 'FilePicker', (p) => {
  const intro = new Gwen.Label(p);
  intro.setText('Pick a file to see its name, size, and MIME type.');
  intro.setBounds(20, 20, 500, 18);

  const picker = new Gwen.FilePicker(p);
  picker.setBounds(20, 50, 360, 22);

  const info = new Gwen.Label(p);
  info.setText('No file selected.');
  info.setBounds(20, 84, 500, 18);

  picker.onFileChanged.on(() => {
    const f = picker.getFile();
    if (!f) {
      info.setText('No file selected.');
      log('FilePicker: cleared');
      return;
    }
    const kb = (f.size / 1024).toFixed(1);
    info.setText(`${f.name} — ${kb} KB — ${f.type || 'unknown type'}`);
    log(`FilePicker: ${f.name} (${f.size} bytes, ${f.type || 'unknown'})`);
  });

  // Properties grid integration — PropertyFile uses the same FilePicker
  // internally and exposes the selected file through `getFile()`.
  const grid = new Gwen.Properties(p);
  grid.setBounds(20, 130, 500, 60);
  const propRow = grid.addRow('Attachment', new Gwen.PropertyFile(grid));
  propRow.onChange.on(() => {
    const prop = propRow.getProperty() as Gwen.PropertyFile | null;
    const f = prop ? prop.getFile() : null;
    log(`PropertyFile: ${f ? f.name : '(cleared)'}`);
  });
});

// ---------------------------------------------------------------------------
// Default page: Button.
// ---------------------------------------------------------------------------

showDemo('Button');

// Expose for tests.
interface DemoWindow {
  Gwen: typeof Gwen;
  gwenCanvas: Gwen.Canvas;
  gwenSkin: Gwen.Skin;
  gwenRenderer: Gwen.WebGL2Renderer;
  demoSections: Record<string, Gwen.Base>;
  showDemo: (name: string) => void;
}
const demoWindow = window as unknown as DemoWindow;
demoWindow.Gwen = Gwen;
demoWindow.gwenCanvas = canvas;
demoWindow.gwenSkin = skin;
demoWindow.gwenRenderer = renderer;
demoWindow.demoSections = demoSections;
demoWindow.showDemo = showDemo;

// ---------------------------------------------------------------------------
// Input + render loop.
// ---------------------------------------------------------------------------

const loop = (): void => {
  canvas.doThink();
  canvas.renderCanvas();
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

window.addEventListener('resize', () => {
  sizeCanvas();
  renderer.resize(htmlCanvas.width, htmlCanvas.height);
  canvas.setBounds(0, 0, htmlCanvas.clientWidth, htmlCanvas.clientHeight);
  canvas.redraw();
});

console.log(
  `GwenJs v${Gwen.VERSION} demo boot — ${Object.keys(demoSections).length} demos, ` +
    `${skin.dynamicSkin.regions.size} skin regions.`,
);
