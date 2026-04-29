// FilePicker (rewritten) + FolderPicker (legacy, unchanged)
//
// FilePicker now holds a real `File` blob, so the tests cover both the
// state-transition surface (setFile / clear / setFileName) and the
// integration with the browser file dialog (Playwright's filechooser
// event drives a Browse… click end-to-end).
//
// Categories covered:
//   1  Render        — construction, default size 220×22, three children
//   2  Visual base   — clear button starts disabled
//   3  State visuals — clear toggles disabled/enabled with file presence
//   4  Pointer input — clicking clear drops the file and fires onFileChanged
//   5  Touch input   — N/A: pointer test exercises the same code path
//   6  Keyboard      — browse + clear are tabable, text field is not
//   7  Events        — onFileChanged payload (string = name, data = File)
//   8  Resize        — N/A: fixed default; docking handles parent resize
//   9  Filter        — setFileType parses GWEN filter into <input accept>
//  10  Dialog        — clicking Browse… opens the OS file dialog
//
// FolderPicker tests at the bottom mirror the original suite verbatim.

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

// Tests run inside Playwright's Node runner where Buffer is a global,
// but the tsconfig doesn't pull in @types/node, so we declare it
// minimally to keep the typecheck clean.
declare const Buffer: { from(data: number[] | string): unknown };

test.describe('T500 FilePicker', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction shape: 220×22 default, has TextBox + clear + browse
  //    children with the expected labels and initial states.
  // =========================================================================

  test('1 — construction: default size 220×22; TextBox + clear (✕) + browse (Browse…); clear starts hidden', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const fp = new G.FilePicker(canvas);
        const b = fp.getBounds();
        const tb = fp.getTextBox();
        const clearBtn = fp.getClearButton();
        const browseBtn = fp.getBrowseButton();
        const r = {
          threw: false,
          w: b.w,
          h: b.h,
          isTextBox: tb instanceof G.TextBox,
          isClearButton: clearBtn instanceof G.Button,
          isBrowseButton: browseBtn instanceof G.Button,
          clearText: clearBtn.getText(),
          browseText: browseBtn.getText(),
          clearHidden: clearBtn.hidden(),
          textBoxText: tb.getText(),
        };
        fp.dispose();
        return r;
      } catch {
        return {
          threw: true, w: 0, h: 0,
          isTextBox: false, isClearButton: false, isBrowseButton: false,
          clearText: '', browseText: '', clearHidden: false, textBoxText: '',
        };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(220);
    expect(result.h).toBe(22);
    expect(result.isTextBox).toBe(true);
    expect(result.isClearButton).toBe(true);
    expect(result.isBrowseButton).toBe(true);
    expect(result.clearText).toBe('✕');
    expect(result.browseText).toBe('Browse…');
    expect(result.clearHidden).toBe(true);
    expect(result.textBoxText).toBe('');
  });

  // =========================================================================
  // 2. setFile fills the display, enables clear, and exposes the File via
  //    getFile()/getFileName(). onFileChanged fires once with the right
  //    payload (string = name, data = the File itself).
  // =========================================================================

  test('2 — setFile updates state, reveals clear, and fires onFileChanged with file payload', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);

      let fired = 0;
      let evString = '';
      let evDataIsFile = false;
      let callerOk = false;
      fp.onFileChanged.on((ev: any) => {
        fired++;
        evString = ev.string ?? '';
        evDataIsFile = ev.data instanceof File;
        callerOk = ev.controlCaller === fp;
      });

      const file = new File(['hello world'], 'note.txt', { type: 'text/plain' });
      fp.setFile(file);

      const r = {
        fired,
        evString,
        evDataIsFile,
        callerOk,
        getFileName: fp.getFileName(),
        getValue: fp.getValue(),
        getFileSame: fp.getFile() === file,
        clearHidden: fp.getClearButton().hidden(),
        textBoxText: fp.getTextBox().getText(),
      };
      fp.dispose();
      return r;
    });
    expect(result.fired).toBe(1);
    expect(result.evString).toBe('note.txt');
    expect(result.evDataIsFile).toBe(true);
    expect(result.callerOk).toBe(true);
    expect(result.getFileName).toBe('note.txt');
    expect(result.getValue).toBe('note.txt');
    expect(result.getFileSame).toBe(true);
    expect(result.clearHidden).toBe(false);
    expect(result.textBoxText).toBe('note.txt');
  });

  // =========================================================================
  // 3. clear() drops the File, empties the display, disables the clear
  //    button, and emits one onFileChanged with an empty payload.
  // =========================================================================

  test('3 — clear() drops the File, empties display, hides clear, and fires onFileChanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      fp.setFile(new File(['x'], 'a.bin'), false);

      let fired = 0;
      let lastString = 'sentinel';
      fp.onFileChanged.on((ev: any) => {
        fired++;
        lastString = ev.string;
      });

      fp.clear();
      const r = {
        fired,
        lastString,
        file: fp.getFile(),
        name: fp.getFileName(),
        clearHidden: fp.getClearButton().hidden(),
        textBoxText: fp.getTextBox().getText(),
      };
      fp.dispose();
      return r;
    });
    expect(result.fired).toBe(1);
    expect(result.lastString).toBe('');
    expect(result.file).toBeNull();
    expect(result.name).toBe('');
    expect(result.clearHidden).toBe(true);
    expect(result.textBoxText).toBe('');
  });

  // =========================================================================
  // 4. setFileName is the "display-only" path used to rehydrate a saved
  //    selection. The display updates and clear enables, but getFile()
  //    stays null.
  // =========================================================================

  test('4 — setFileName updates display only; getFile() stays null', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      fp.setFileName('old-selection.dat');
      const r = {
        getFileName: fp.getFileName(),
        getFile: fp.getFile(),
        textBoxText: fp.getTextBox().getText(),
        clearHidden: fp.getClearButton().hidden(),
      };
      fp.dispose();
      return r;
    });
    expect(result.getFileName).toBe('old-selection.dat');
    expect(result.getFile).toBeNull();
    expect(result.textBoxText).toBe('old-selection.dat');
    expect(result.clearHidden).toBe(false);
  });

  // =========================================================================
  // 5. setValue('') clears; setValue('x') routes through setFileName.
  //    Property-grid alias parity with the old API.
  // =========================================================================

  test('5 — setValue("") clears; setValue("x") sets display name without producing a File', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      fp.setFile(new File(['x'], 'before.txt'), false);

      fp.setValue('renamed.txt');
      const a = { name: fp.getFileName(), file: fp.getFile() };

      fp.setValue('');
      const b = { name: fp.getFileName(), file: fp.getFile() };

      fp.dispose();
      return { a, b };
    });
    expect(result.a.name).toBe('renamed.txt');
    // setFileName preserves the held File — only setFile/clear can change it.
    expect(result.a.file).not.toBeNull();
    expect(result.b.name).toBe('');
    expect(result.b.file).toBeNull();
  });

  // =========================================================================
  // 6. Keyboard nav: clear + browse are tabable; the text field is not
  //    tabable, not mouse-focusable, not keyboard-focusable.
  // =========================================================================

  test('6 — clear + browse buttons are tabable; text field is not in tab order', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      const tb = fp.getTextBox();
      const r = {
        browseTabable: fp.getBrowseButton().isTabable(),
        clearTabable: fp.getClearButton().isTabable(),
        textTabable: tb.isTabable(),
        textMouse: tb.getMouseInputEnabled(),
        textKeyboard: tb.getKeyboardInputEnabled(),
        textEditable: tb.isEditable(),
      };
      fp.dispose();
      return r;
    });
    expect(result.browseTabable).toBe(true);
    expect(result.clearTabable).toBe(true);
    expect(result.textTabable).toBe(false);
    expect(result.textMouse).toBe(false);
    expect(result.textKeyboard).toBe(false);
    expect(result.textEditable).toBe(false);
  });

  // =========================================================================
  // 7. setAccept / setFileType: GWEN's "Label | *.ext1;*.ext2" string is
  //    parsed into the browser's comma-separated `accept` value. Direct
  //    setAccept overrides the parsed form.
  // =========================================================================

  test('7 — setFileType parses GWEN filter to comma-separated accept; setAccept overrides', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);

      const before = { type: fp.getFileType(), accept: fp.getAccept() };

      fp.setFileType('Images | *.png;*.jpg');
      const afterFilter = { type: fp.getFileType(), accept: fp.getAccept() };

      fp.setAccept('image/*');
      const afterDirect = fp.getAccept();

      fp.dispose();
      return { before, afterFilter, afterDirect };
    });
    expect(result.before.type).toBe('Any Type | *.*');
    expect(result.before.accept).toBe('');
    expect(result.afterFilter.type).toBe('Images | *.png;*.jpg');
    expect(result.afterFilter.accept).toBe('.png,.jpg');
    expect(result.afterDirect).toBe('image/*');
  });

  // =========================================================================
  // 8. Pointer click on the clear button when a file is held → clears
  //    state and fires onFileChanged. Drives the click through the
  //    Canvas's input router so we exercise the real path.
  // =========================================================================

  test('8 — clicking the clear button (when visible) drops the file and fires onFileChanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      fp.setBounds(20, 400, 220, 22);
      fp.setFile(new File(['hi'], 'hello.txt'), false);

      // Force a layout pass so the docked Right children get their
      // actual positions. doThink is the per-frame entry point that
      // walks the dirty tree and runs recurseLayout.
      canvas.doThink();

      let fired = 0;
      let lastString = '__sentinel';
      fp.onFileChanged.on((ev: any) => {
        fired++;
        lastString = ev.string;
      });

      const cbCenter = fp.getClearButton().localPosToCanvas({
        x: fp.getClearButton().width() / 2,
        y: fp.getClearButton().height() / 2,
      });

      // Drive the click through the canvas input router — same code
      // path real pointer events take, but without any DPR/coordinate
      // translation surprises.
      canvas.inputMouseMoved(cbCenter.x, cbCenter.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);

      const r = {
        fired,
        lastString,
        getFile: fp.getFile(),
        clearHidden: fp.getClearButton().hidden(),
      };
      fp.dispose();
      return r;
    });
    expect(result.fired).toBe(1);
    expect(result.lastString).toBe('');
    expect(result.getFile).toBeNull();
    expect(result.clearHidden).toBe(true);
  });

  // =========================================================================
  // 9. Clicking Browse… opens the native file chooser. Verified by
  //    Playwright's filechooser event; then we drive a synthetic file
  //    selection and confirm the picker's state updates.
  // =========================================================================

  test('9 — Browse… click opens filechooser; selecting a file updates state', async ({ page }) => {
    // Set up the picker, run a layout pass, install the event hook,
    // then return the canvas-space coordinate of the Browse… button so
    // the outer Node-side test can drive the click + filechooser dance.
    const center = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      fp.setBounds(20, 440, 220, 22);
      canvas.doThink();

      (window as any).__fpTest9 = { fp, fired: 0, lastString: '__sentinel' };
      fp.onFileChanged.on((ev: any) => {
        const t = (window as any).__fpTest9;
        t.fired++;
        t.lastString = ev.string;
      });

      const c = fp.getBrowseButton().localPosToCanvas({
        x: fp.getBrowseButton().width() / 2,
        y: fp.getBrowseButton().height() / 2,
      });
      return { x: c.x, y: c.y };
    });

    const fcPromise = page.waitForEvent('filechooser');

    // Triggering the dialog requires a real DOM-side click on the
    // synthesized <input type="file">. Going through the input router
    // calls input.click() on a freshly created element, which Playwright
    // observes as a filechooser event.
    await page.evaluate((c) => {
      const canvas = (window as any).gwenCanvas;
      canvas.inputMouseMoved(c.x, c.y, 0, 0);
      canvas.inputMouseButton(0, true);
      canvas.inputMouseButton(0, false);
    }, center);

    const fileChooser = await fcPromise;
    await fileChooser.setFiles({
      name: 'pick.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from([0xde, 0xad, 0xbe, 0xef]),
    });

    await page.waitForFunction(() => {
      const t = (window as any).__fpTest9;
      return t && t.fired > 0;
    });

    const after = await page.evaluate(() => {
      const t = (window as any).__fpTest9;
      const fp = t.fp;
      const f = fp.getFile();
      const r = {
        fired: t.fired,
        lastString: t.lastString,
        name: f ? f.name : null,
        size: f ? f.size : -1,
        clearHidden: fp.getClearButton().hidden(),
      };
      fp.dispose();
      delete (window as any).__fpTest9;
      return r;
    });
    expect(after.fired).toBe(1);
    expect(after.lastString).toBe('pick.bin');
    expect(after.name).toBe('pick.bin');
    expect(after.size).toBe(4);
    expect(after.clearHidden).toBe(false);
  });

  // =========================================================================
  // 10. PropertyFile integration — picking a file in the underlying
  //     FilePicker exposes it via PropertyFile.getFile() and propagates
  //     onChange with file.name as the canonical string value.
  // =========================================================================

  test('10 — PropertyFile.getFile() returns the underlying File; onChange propagates the name', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const props = new G.Properties(canvas);
      const propFile = new G.PropertyFile(props);
      const row = props.addRow('Attachment', propFile);

      let fired = 0;
      let lastString = '';
      row.onChange.on((ev: any) => {
        fired++;
        lastString = ev.string ?? '';
      });

      const f = new File(['data'], 'doc.bin');
      propFile.getFilePicker().setFile(f);

      const r = {
        fired,
        lastString,
        propValue: propFile.getPropertyValue(),
        propFileSame: propFile.getFile() === f,
      };
      props.dispose();
      return r;
    });
    expect(result.fired).toBe(1);
    expect(result.lastString).toBe('doc.bin');
    expect(result.propValue).toBe('doc.bin');
    expect(result.propFileSame).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FolderPicker — unchanged from the original implementation; tests
// retained verbatim to confirm we didn't regress while rewriting the
// FilePicker that lives alongside it in the same file.
// ---------------------------------------------------------------------------

test.describe('T501 FolderPicker', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  test('1 — FolderPicker: construction does not throw; default size 100×20; has TextBox and Button', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const fp = new G.FolderPicker(canvas);
        const b = fp.getBounds();
        const tb = fp.getTextBox();
        const btn = fp.getButton();
        const isTextBox = tb instanceof G.TextBox;
        const isButton = btn instanceof G.Button;
        const btnText = btn.getText();
        fp.dispose();
        return { threw: false, w: b.w, h: b.h, isTextBox, isButton, btnText };
      } catch {
        return { threw: true, w: 0, h: 0, isTextBox: false, isButton: false, btnText: '' };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.w).toBe(100);
    expect(result.h).toBe(20);
    expect(result.isTextBox).toBe(true);
    expect(result.isButton).toBe(true);
    expect(result.btnText).toBe('..');
  });

  test('2 — setFolder("/home/user") → getFolder() matches; onFolderChanged fires with correct payload', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FolderPicker(canvas);

      let changeCount = 0;
      let changedString = '';
      let callerOk = false;
      fp.onFolderChanged.on((ev: any) => {
        changeCount++;
        changedString = ev.string ?? '';
        callerOk = ev.controlCaller === fp;
      });

      fp.setFolder('/home/user');
      const getFolder = fp.getFolder();
      const getValue = fp.getValue();
      const tbText = fp.getTextBox().getText();

      fp.dispose();
      return { changeCount, changedString, callerOk, getFolder, getValue, tbText };
    });
    expect(result.changeCount).toBe(1);
    expect(result.changedString).toBe('/home/user');
    expect(result.callerOk).toBe(true);
    expect(result.getFolder).toBe('/home/user');
    expect(result.getValue).toBe('/home/user');
    expect(result.tbText).toBe('/home/user');
  });
});
