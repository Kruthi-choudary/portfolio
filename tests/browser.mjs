import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'

let server, browser
let passed = 0
const pass = name => { console.log(`PASS ${name}`); passed++ }
mkdirSync('test-results', { recursive: true })
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 5175, strictPort: true } })
  await server.listen()
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  // Capture exaggerated geometry before evaluating the normal art direction.
  for (const mode of ['exaggerated', 'wireframe']) {
    await page.goto(`http://127.0.0.1:5175/?fabricDebug=${mode}`)
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.shaderFrame === 'glsl-flowing-checks-v5')
    assert.equal(await page.locator('canvas').getAttribute('data-renderer'), 'glsl-flowing-checks-v5')
    await page.locator('canvas').screenshot({ path: `test-results/fabric-${mode}.png` })
  }
  pass('Diagnostic mesh version and measured depth; captured exaggerated and wireframe frames')
  await page.goto('http://127.0.0.1:5175')
  await page.locator('canvas').waitFor()
  await page.waitForFunction(() => Number(document.querySelector('canvas').dataset.time) > .2 && document.querySelector('canvas').dataset.shaderFrame === 'glsl-flowing-checks-v5')
  const bounds = await page.locator('canvas').boundingBox()
  assert.equal(bounds.width, 1440); assert.equal(bounds.height, 900)
  pass('WebGL canvas fills desktop viewport')
  await page.waitForFunction(() => [...document.querySelectorAll('.letter')].every(el => getComputedStyle(el).opacity === '1'))
  const name = await page.locator('h1').evaluate(el => {
    const boxes = [...el.querySelectorAll('.letter')].map(el => el.getBoundingClientRect())
    return { label: el.getAttribute('aria-label'), firstTop: boxes[0].top, lastTop: boxes.at(-1).top, left: boxes[0].left, right: boxes.at(-1).right }
  })
  assert.equal(name.label, 'KRUTHI ANNANKI'); assert.ok(Math.abs(name.firstTop - name.lastTop) < 1); assert.ok(name.left >= 0 && name.right <= 1440)
  pass('Completed desktop letter reveal remains on one line without clipping')
  const before = await page.locator('canvas').screenshot()
  await page.waitForTimeout(1500)
  const after = await page.locator('canvas').screenshot()
  assert.ok(!before.equals(after))
  pass('Idle WebGL output changes over time')
  await page.mouse.move(850, 350)
  await page.waitForFunction(() => Number(document.querySelector('canvas').parentElement.dataset.pointer) > .5)
  pass('Pointer influences surface uniforms')
  await page.screenshot({ path: 'test-results/checker-desktop.png' })
  await page.getByRole('link', { name: /EXPLORE MY WORK/ }).click()
  await page.waitForFunction(() => location.hash === '#work' && scrollY > 500)
  pass('Explore performs a real document scroll')
  assert.deepEqual(errors, [])
  pass('No captured console or page errors')
  for (const width of [390, 768, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('http://127.0.0.1:5175')
    await page.waitForFunction(() => [...document.querySelectorAll('.letter')].every(el => getComputedStyle(el).opacity === '1'))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const fits = await page.locator('h1>span').evaluate(el => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth })
    assert.ok(fits)
    await page.screenshot({ path: `test-results/checker-${width}.png` })
  }
  pass('Responsive name and page fit at 390, 768, and 1920 pixels')
  const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await reduced.goto('http://127.0.0.1:5175')
  await reduced.locator('canvas').waitFor()
  assert.equal(await reduced.locator('.letter').first().evaluate(el => getComputedStyle(el).animationName), 'none')
  await reduced.waitForTimeout(800)
  assert.equal(await reduced.locator('canvas').evaluate(el => el.dataset.time), '0.000')
  pass('Reduced motion disables letter and surface animation')
  const fallback = await browser.newPage()
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args) }
  })
  await fallback.goto('http://127.0.0.1:5175')
  await fallback.locator('.is-fallback').waitFor()
  assert.equal(await fallback.locator('h1').getAttribute('aria-label'), 'KRUTHI ANNANKI')
  await fallback.getByRole('link', { name: /EXPLORE MY WORK/ }).click()
  await fallback.waitForFunction(() => scrollY > 100)
  pass('Unavailable-WebGL fallback preserves content and navigation')
} catch (e) {
  console.error(`FAILED OR BLOCKED after ${passed} passed checks: ${e.message}`)
  process.exitCode = 1
} finally { await browser?.close(); await server?.close() }
