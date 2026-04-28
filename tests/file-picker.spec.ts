// T500/T501 — FilePicker + FolderPicker
//
// Categories covered:
//   1  Render        — construction does not throw; default size 100×20
//   2  Visual base   — Skipped: light API-surface tests only; no pixel checks needed
//   3  State visuals — N/A: no distinct visual states beyond the TextBox/Button children
//   4  Pointer input — N/A: the "..." button opens a native file/folder dialog which
//                     cannot be driven in Playwright (relies on <input type=file> click)
//   5  Touch input   — N/A: same reason as pointer input
//   6  Keyboard      — N/A: no custom keyboard handling on the composite itself
//   7  Events        — #3 onFileChanged fires from setFileName;
//                     #6 onFolderChanged fires from setFolder
//   8  Resize        — N/A: fixed default size; no parent-resize handling

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T500 FilePicker + T501 FolderPicker', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. FilePicker: construction, default size 100×20, textbox + button children
  // =========================================================================

  test('1 — FilePicker: construction does not throw; default size 100×20; has TextBox and Button', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const fp = new G.FilePicker(canvas);
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

  // =========================================================================
  // 2. setFileType / getFileType round-trip
  // =========================================================================

  test('2 — setFileType("Image | *.png") → getFileType() returns same string', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      const before = fp.getFileType();
      fp.setFileType('Image | *.png');
      const after = fp.getFileType();
      fp.dispose();
      return { before, after };
    });
    expect(result.before).toBe('Any Type | *.*');
    expect(result.after).toBe('Image | *.png');
  });

  // =========================================================================
  // 3. setFileName updates textbox and fires onFileChanged
  // =========================================================================

  test('3 — setFileName("photo.png") updates TextBox and fires onFileChanged with correct payload', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);

      let changeCount = 0;
      let changedString = '';
      let callerOk = false;
      fp.onFileChanged.on((ev: any) => {
        changeCount++;
        changedString = ev.string ?? '';
        callerOk = ev.controlCaller === fp;
      });

      fp.setFileName('photo.png');
      const tbText = fp.getTextBox().getText();

      fp.dispose();
      return { changeCount, changedString, callerOk, tbText };
    });
    expect(result.changeCount).toBe(1);
    expect(result.changedString).toBe('photo.png');
    expect(result.callerOk).toBe(true);
    expect(result.tbText).toBe('photo.png');
  });

  // =========================================================================
  // 4. getFileName returns the set name
  // =========================================================================

  test('4 — getFileName() returns the value set by setFileName(); getValue() alias matches', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const fp = new G.FilePicker(canvas);
      fp.setFileName('doc.txt');
      const getName = fp.getFileName();
      const getValue = fp.getValue();
      fp.dispose();
      return { getName, getValue };
    });
    expect(result.getName).toBe('doc.txt');
    expect(result.getValue).toBe('doc.txt');
  });

  // =========================================================================
  // 5. FolderPicker: construction
  // =========================================================================

  test('5 — FolderPicker: construction does not throw; default size 100×20; has TextBox and Button', async ({ page }) => {
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

  // =========================================================================
  // 6. FolderPicker: setFolder / getFolder round-trip; fires onFolderChanged
  // =========================================================================

  test('6 — setFolder("/home/user") → getFolder() matches; onFolderChanged fires with correct payload', async ({ page }) => {
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
