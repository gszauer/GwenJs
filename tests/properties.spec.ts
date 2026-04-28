// T404 — Properties + PropertyRow + PropertyBase + PropertyText
//
// Categories covered:
//   1  Render        — N/A: Properties renders rows via skin.drawPropertyRow; no dedicated pixel test
//                     (tested implicitly via doThink/renderCanvas in child tests)
//   2  Visual base   — Skipped: GPU/skin variance across CI
//   3  State visuals — N/A: no visual states beyond editing/hover; covered by functional tests
//   4  Pointer input — N/A: splitter drag not tested (SplitterBar has its own spec)
//   5  Touch input   — N/A: same reason
//   6  Keyboard      — N/A: Properties/PropertyRow have no direct keyboard handling
//   7  Events        — #5 PropertyText.onChange fires on value change;
//                         #6 Properties.onChange fires when any row changes
//   8  Resize        — N/A: Properties.layout keeps splitter full-height; no parent-resize test needed

import { test, expect } from '@playwright/test';
import { gotoDemo, waitForFirstFrame } from './helpers';

test.describe('T404 Properties', () => {
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
    await waitForFirstFrame(page);
  });

  // =========================================================================
  // 1. Construction: splitter at x=80
  // =========================================================================

  test('1 — new Properties(canvas): getSplitWidth() === 80', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      try {
        const props = new G.Properties(canvas);
        const splitWidth = props.getSplitWidth();
        props.dispose();
        return { threw: false, splitWidth };
      } catch {
        return { threw: true, splitWidth: -1 };
      }
    });
    expect(result.threw).toBe(false);
    expect(result.splitWidth).toBe(80);
  });

  // =========================================================================
  // 2. add('key', 'value') returns PropertyRow with text label
  // =========================================================================

  test('2 — add("key", "value") returns PropertyRow; label text is "key"; property value is "value"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const props = new G.Properties(canvas);
      const row = props.add('myKey', 'myValue');

      const isRow = row instanceof G.PropertyRow;
      const labelText = row.getLabel().getText();
      const prop = row.getProperty();
      const propValue = prop ? prop.getPropertyValue() : null;

      props.dispose();
      return { isRow, labelText, propValue };
    });
    expect(result.isRow).toBe(true);
    expect(result.labelText).toBe('myKey');
    expect(result.propValue).toBe('myValue');
  });

  // =========================================================================
  // 3. getSplitWidth() === 80
  // =========================================================================

  test('3 — getSplitWidth() returns 80 (splitter initial x position)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const props = new G.Properties(canvas);
      const sw = props.getSplitWidth();
      props.dispose();
      return sw;
    });
    expect(result).toBe(80);
  });

  // =========================================================================
  // 4. PropertyRow has label + property after add()
  // =========================================================================

  test('4 — PropertyRow has non-null label and PropertyText property after add()', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const props = new G.Properties(canvas);
      const row = props.add('field', 'hello');

      const label = row.getLabel();
      const prop = row.getProperty();

      const hasLabel = label !== null;
      const hasProp = prop !== null;
      const isPropertyText = prop instanceof G.PropertyText;
      const propVal = prop ? prop.getPropertyValue() : '';

      props.dispose();
      return { hasLabel, hasProp, isPropertyText, propVal };
    });
    expect(result.hasLabel).toBe(true);
    expect(result.hasProp).toBe(true);
    expect(result.isPropertyText).toBe(true);
    expect(result.propVal).toBe('hello');
  });

  // =========================================================================
  // 5. PropertyText.setPropertyValue('new') updates text and fires onChange
  // =========================================================================

  test('5 — PropertyText.setPropertyValue("new") updates value and fires onChange', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const props = new G.Properties(canvas);
      const row = props.add('label', 'old');
      const prop = row.getProperty() as any;

      let changeCount = 0;
      let changedValue = '';
      prop.onChange.on((ev: any) => {
        changeCount++;
        changedValue = ev.string ?? '';
      });

      prop.setPropertyValue('new', true);
      const currentValue = prop.getPropertyValue();

      props.dispose();
      return { changeCount, changedValue, currentValue };
    });
    expect(result.currentValue).toBe('new');
    expect(result.changeCount).toBeGreaterThanOrEqual(1);
    expect(result.changedValue).toBe('new');
  });

  // =========================================================================
  // 6. Properties.onChange fires when any row's property changes
  // =========================================================================

  test('6 — Properties.onChange fires when a row changes; info.string matches new value', async ({ page }) => {
    const result = await page.evaluate(() => {
      const G = (window as any).Gwen;
      const canvas = (window as any).gwenCanvas;
      const props = new G.Properties(canvas);
      props.add('alpha', 'a');
      const rowB = props.add('beta', 'b');

      let propChangeCount = 0;
      let propChangeString = '';
      props.onChange.on((ev: any) => {
        propChangeCount++;
        propChangeString = ev.string ?? '';
      });

      // Mutate beta row's property.
      const propB = rowB.getProperty() as any;
      propB.setPropertyValue('updated', true);

      props.dispose();
      return { propChangeCount, propChangeString };
    });
    expect(result.propChangeCount).toBeGreaterThanOrEqual(1);
    expect(result.propChangeString).toBe('updated');
  });
});
