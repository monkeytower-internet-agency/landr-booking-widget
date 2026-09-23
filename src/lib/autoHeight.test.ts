/**
 * landr-6eita.1: the embedded widget posts { type: 'landr:resize', height } to
 * its parent whenever its content height changes, so the host page can size
 * the iframe instead of the widget scrolling inside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type AutoHeightWindow,
  EMBEDDED_ATTR,
  RESIZE_MESSAGE_TYPE,
  measureContentHeight,
  startAutoHeight,
} from './autoHeight'

/** ResizeObserver stand-in whose callback the test fires by hand. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  observed: Element[] = []
  disconnected = false
  private readonly callback: () => void
  constructor(callback: () => void) {
    this.callback = callback
    FakeResizeObserver.instances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true
  }
  fire() {
    this.callback()
  }
}

let frames: FrameRequestCallback[] = []
function flushFrames() {
  const pending = frames
  frames = []
  pending.forEach((cb) => cb(0))
}

let root: HTMLElement
let contentHeight = 0

function setContentHeight(px: number) {
  contentHeight = px
}

/** A window whose parent is a different object (i.e. embedded). */
function makeWindow(opts: { embedded: boolean }) {
  const parent = { postMessage: vi.fn() }
  const win = {
    document,
    ResizeObserver: FakeResizeObserver,
    MutationObserver: window.MutationObserver,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    innerHeight: 3000,
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    },
    cancelAnimationFrame: vi.fn(),
  } as unknown as AutoHeightWindow
  ;(win as unknown as { parent: unknown }).parent = opts.embedded ? parent : win
  return { win, parent }
}

beforeEach(() => {
  FakeResizeObserver.instances = []
  frames = []
  document.body.innerHTML = '<div id="root"></div>'
  root = document.getElementById('root')!
  // jsdom has no layout — drive the measured height by hand.
  Object.defineProperty(root, 'scrollHeight', {
    configurable: true,
    get: () => contentHeight,
  })
  setContentHeight(640)
})

// Every started instance is torn down so its observers/listeners can't act on
// the next test's DOM.
let stops: Array<() => void> = []
function start(win: AutoHeightWindow) {
  const stop = startAutoHeight(win)
  stops.push(stop)
  return stop
}

afterEach(() => {
  stops.forEach((stop) => stop())
  stops = []
  document.documentElement.removeAttribute(EMBEDDED_ATTR)
  document.body.innerHTML = ''
})

describe('startAutoHeight', () => {
  it('does nothing when not embedded', () => {
    const { win, parent } = makeWindow({ embedded: false })
    start(win)
    flushFrames()
    expect(FakeResizeObserver.instances).toHaveLength(0)
    expect(parent.postMessage).not.toHaveBeenCalled()
    expect(document.documentElement.hasAttribute(EMBEDDED_ATTR)).toBe(false)
  })

  it('posts the initial content height to the parent with target "*"', () => {
    const { win, parent } = makeWindow({ embedded: true })
    start(win)
    expect(document.documentElement.hasAttribute(EMBEDDED_ATTR)).toBe(true)
    expect(FakeResizeObserver.instances[0]!.observed).toContain(root)
    flushFrames()
    expect(parent.postMessage).toHaveBeenCalledTimes(1)
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 640 },
      '*',
    )
  })

  it('coalesces a burst of resizes into one post per animation frame', () => {
    const { win, parent } = makeWindow({ embedded: true })
    start(win)
    flushFrames()
    const ro = FakeResizeObserver.instances[0]!
    setContentHeight(700)
    ro.fire()
    setContentHeight(760)
    ro.fire()
    ro.fire()
    expect(frames).toHaveLength(1)
    flushFrames()
    expect(parent.postMessage).toHaveBeenCalledTimes(2)
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 760 },
      '*',
    )
  })

  it('posts only when the integer height changes — and posts shrinks too', () => {
    const { win, parent } = makeWindow({ embedded: true })
    start(win)
    flushFrames()
    const ro = FakeResizeObserver.instances[0]!
    ro.fire()
    flushFrames()
    expect(parent.postMessage).toHaveBeenCalledTimes(1)
    // Sub-pixel growth rounds up to a new integer height.
    setContentHeight(640.2)
    ro.fire()
    flushFrames()
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 641 },
      '*',
    )
    setContentHeight(420)
    ro.fire()
    flushFrames()
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 420 },
      '*',
    )
    expect(parent.postMessage).toHaveBeenCalledTimes(3)
  })

  it('grows to fit an open dialog taller than the content', async () => {
    const { win, parent } = makeWindow({ embedded: true })
    start(win)
    flushFrames()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    // Centred in a 640px frame: top = 320 - 450.
    dialog.getBoundingClientRect = () =>
      ({ top: -130, height: 900, bottom: 770 }) as DOMRect
    const portal = document.createElement('div')
    portal.appendChild(dialog)
    document.body.appendChild(portal)
    // MutationObserver callbacks run as a microtask.
    await Promise.resolve()
    expect(FakeResizeObserver.instances[0]!.observed).toContain(dialog)
    flushFrames()
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 964 },
      '*',
    )
    // Closing the dialog lets the height drop back to the content.
    portal.remove()
    await Promise.resolve()
    flushFrames()
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 640 },
      '*',
    )
  })

  it('centres a newly opened dialog on the interaction that opened it', async () => {
    const { win } = makeWindow({ embedded: true })
    start(win)
    const trigger = document.createElement('button')
    trigger.getBoundingClientRect = () => ({ top: 1500, height: 40 }) as DOMRect
    root.appendChild(trigger)
    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    const openDialog = async (height: number) => {
      const dialog = document.createElement('div')
      dialog.setAttribute('role', 'dialog')
      dialog.getBoundingClientRect = () =>
        ({ top: 0, height, bottom: height }) as DOMRect
      document.body.appendChild(dialog)
      await Promise.resolve()
      return dialog
    }
    expect((await openDialog(400)).style.top).toBe('1520px')

    // Near the bottom edge it is clamped so the whole dialog stays inside
    // the iframe (innerHeight 3000, 400/2 + 32 margin).
    trigger.getBoundingClientRect = () => ({ top: 2950, height: 40 }) as DOMRect
    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect((await openDialog(400)).style.top).toBe('2768px')
  })

  // landr-tkgx8.3 (c): after anchorDialog moves a dialog down (or it grows
  // once open), its bottom edge — not just its height — must fit the frame.
  it('floors the height on an open dialog\'s bottom edge', async () => {
    const { win, parent } = makeWindow({ embedded: true })
    start(win)
    flushFrames()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.getBoundingClientRect = () =>
      ({ top: 500, height: 300, bottom: 800 }) as DOMRect
    document.body.appendChild(dialog)
    await Promise.resolve()
    flushFrames()
    // 300 + 2 * 32 = 364 < 640 content; the bottom edge 800 + 32 wins.
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 832 },
      '*',
    )
  })

  // landr-tkgx8.3 (a): a portalled Select / Popover menu opening near the
  // bottom of the widget is fixed-positioned outside #root — without a floor
  // the iframe clips it.
  it('grows to fit portalled popper content below the content', async () => {
    const { win, parent } = makeWindow({ embedded: true })
    start(win)
    flushFrames()
    const trigger = document.createElement('button')
    trigger.getBoundingClientRect = () => ({ top: 600, height: 40 }) as DOMRect
    root.appendChild(trigger)
    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-radix-popper-content-wrapper', '')
    let bottom = -100 // Radix mounts it off-screen, then positions it.
    wrapper.getBoundingClientRect = () =>
      ({ top: bottom - 200, height: 200, bottom }) as DOMRect
    const portal = document.createElement('div')
    portal.appendChild(wrapper)
    document.body.appendChild(portal)
    await Promise.resolve()
    expect(FakeResizeObserver.instances[0]!.observed).toContain(wrapper)
    // Popper content is positioned by Radix, never re-anchored by us.
    expect(wrapper.style.top).toBe('')
    flushFrames()
    expect(parent.postMessage).toHaveBeenCalledTimes(1)

    // Positioning is an inline-style change, not a resize — still re-measured.
    bottom = 900
    wrapper.style.transform = 'translate(0px, 700px)'
    await Promise.resolve()
    flushFrames()
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 908 },
      '*',
    )

    portal.remove()
    await Promise.resolve()
    flushFrames()
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 640 },
      '*',
    )
  })

  it('leaves a dialog centred when there was no prior interaction', async () => {
    const { win } = makeWindow({ embedded: true })
    start(win)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    await Promise.resolve()
    expect(dialog.style.top).toBe('')
  })

  it('tears down: disconnects and removes the <html> marker', () => {
    const { win } = makeWindow({ embedded: true })
    const stop = start(win)
    stop()
    expect(FakeResizeObserver.instances[0]!.disconnected).toBe(true)
    expect(document.documentElement.hasAttribute(EMBEDDED_ATTR)).toBe(false)
  })
  it('does not post a 0 height before the app has rendered', () => {
    setContentHeight(0)
    const { win, parent } = makeWindow({ embedded: true })
    start(win)
    flushFrames()
    expect(parent.postMessage).not.toHaveBeenCalled()
    setContentHeight(500)
    FakeResizeObserver.instances[0]!.fire()
    flushFrames()
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: RESIZE_MESSAGE_TYPE, height: 500 },
      '*',
    )
  })
})

describe('measureContentHeight', () => {
  it('measures #root, not the viewport-floored document height', () => {
    setContentHeight(333.4)
    expect(measureContentHeight(document)).toBe(334)
  })
})
