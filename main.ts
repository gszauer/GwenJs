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
canvas.setBackgroundColor(Gwen.color(122, 144, 144, 255));
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
}

// ---------------------------------------------------------------------------
// Bottom: StatusBar.
// ---------------------------------------------------------------------------

const statusBar = new Gwen.StatusBar(canvas);
statusBar.setText(`GwenJs Unit Test — v${Gwen.VERSION}`);

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
  const ink = Gwen.color(40, 40, 40, 255);
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
    a.addText(para, ink);
    a.addLineBreak();
    a.addLineBreak();
  }

  const b = new Gwen.RichLabel(p);
  b.setBounds(x0 + colW + gap, 10, colW, 300);
  for (const para of colB) {
    b.addText(para, ink);
  }

  const c = new Gwen.RichLabel(p);
  c.setBounds(x0 + 2 * (colW + gap), 10, colW, 300);
  for (const para of colC) {
    c.addText(para, ink);
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
  const sp = new Gwen.CrossSplitter(p);
  sp.setBounds(10, 10, 500, 300);
  const colors = [
    Gwen.color(170, 80, 80, 255),
    Gwen.color(80, 170, 80, 255),
    Gwen.color(80, 80, 170, 255),
    Gwen.color(170, 170, 80, 255),
  ];
  for (let i = 0; i < 4; i++) {
    const leaf = new Gwen.ColorDisplay(sp);
    leaf.setColor(colors[i]);
    sp.setPanel(i, leaf);
  }
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

addDemo(nonStandardCat, 'ColorPicker', (p) => {
  const cp = new Gwen.ColorPicker(p);
  cp.setBounds(20, 20, 256, 150);
  cp.setColor(Gwen.color(255, 100, 50, 255));

  const hsv = new Gwen.HSVColorPicker(p);
  hsv.setBounds(300, 20, 256, 180);
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
