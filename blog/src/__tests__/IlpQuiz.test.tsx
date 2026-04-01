import { render, screen, fireEvent } from '@testing-library/react'
import IlpQuiz, {
  calculateScore,
  renderResultCanvas,
} from '@/components/interactive/IlpQuiz'
import { QUIZ_DISCLAIMER, SITE_URL } from '@/lib/ilp-constants'

// ─── Pure function: calculateScore ─────────────────────────────────────────

describe('calculateScore (pure function)', () => {
  it('all Yes: score = 5 (Q5 Yes = 0 points)', () => {
    const answers = [true, true, true, true, true, true]
    expect(calculateScore(answers)).toBe(5)
  })

  it('all No: score = 1 (Q5 No = 1 point, others = 0)', () => {
    const answers = [false, false, false, false, false, false]
    expect(calculateScore(answers)).toBe(1)
  })

  it('all Yes except Q5 No: score = 6 (maximum)', () => {
    const answers = [true, true, true, true, false, true]
    expect(calculateScore(answers)).toBe(6)
  })

  it('all No except Q5 Yes: score = 0 (minimum)', () => {
    const answers = [false, false, false, false, true, false]
    expect(calculateScore(answers)).toBe(0)
  })

  it('mixed scenario: Q1 Yes, Q2 No, Q3 Yes, Q4 No, Q5 No, Q6 Yes = 4', () => {
    // Q1 Yes = 1, Q2 No = 0, Q3 Yes = 1, Q4 No = 0, Q5 No (inverted) = 1, Q6 Yes = 1
    const answers = [true, false, true, false, false, true]
    expect(calculateScore(answers)).toBe(4)
  })
})

// ─── Result tiers ──────────────────────────────────────────────────────────

describe('Result tiers', () => {
  it('score 5-6: shows "you might prefer a DIY approach" text', () => {
    render(<IlpQuiz />)

    // Answer all Yes except Q5 No for score 6 (HIGH tier)
    fireEvent.click(screen.getByTestId('q0-yes'))
    fireEvent.click(screen.getByTestId('q1-yes'))
    fireEvent.click(screen.getByTestId('q2-yes'))
    fireEvent.click(screen.getByTestId('q3-yes'))
    fireEvent.click(screen.getByTestId('q4-no'))
    fireEvent.click(screen.getByTestId('q5-yes'))

    fireEvent.click(screen.getByTestId('see-result-btn'))

    expect(screen.getByTestId('result-text').textContent).toContain(
      'you might prefer a DIY approach'
    )
  })

  it('score 3-4: shows "could go either way" text', () => {
    render(<IlpQuiz />)

    // Q1 Yes, Q2 Yes, Q3 Yes, Q4 No, Q5 Yes, Q6 No = 3
    fireEvent.click(screen.getByTestId('q0-yes'))
    fireEvent.click(screen.getByTestId('q1-yes'))
    fireEvent.click(screen.getByTestId('q2-yes'))
    fireEvent.click(screen.getByTestId('q3-no'))
    fireEvent.click(screen.getByTestId('q4-yes'))
    fireEvent.click(screen.getByTestId('q5-no'))

    fireEvent.click(screen.getByTestId('see-result-btn'))

    expect(screen.getByTestId('result-text').textContent).toContain(
      'could go either way'
    )
  })

  it('score 0-2: shows "ILP\'s structure may help" text', () => {
    render(<IlpQuiz />)

    // All No except Q5 Yes = 0
    fireEvent.click(screen.getByTestId('q0-no'))
    fireEvent.click(screen.getByTestId('q1-no'))
    fireEvent.click(screen.getByTestId('q2-no'))
    fireEvent.click(screen.getByTestId('q3-no'))
    fireEvent.click(screen.getByTestId('q4-yes'))
    fireEvent.click(screen.getByTestId('q5-no'))

    fireEvent.click(screen.getByTestId('see-result-btn'))

    expect(screen.getByTestId('result-text').textContent).toContain(
      "ILP's structure may help"
    )
  })
})

// ─── Component behavior ────────────────────────────────────────────────────

describe('IlpQuiz component', () => {
  it('renders all 6 questions', () => {
    render(<IlpQuiz />)

    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`question-${i}`)).toBeInTheDocument()
    }
  })

  it('"See your result" button is disabled until all 6 answered', () => {
    render(<IlpQuiz />)

    const btn = screen.getByTestId('see-result-btn')
    expect(btn).toBeDisabled()
  })

  it('answering all 6 enables the button', () => {
    render(<IlpQuiz />)

    // Answer all 6
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId(`q${i}-yes`))
    }

    expect(screen.getByTestId('see-result-btn')).not.toBeDisabled()
  })

  it('clicking "See your result" shows the result card', () => {
    render(<IlpQuiz />)

    // Answer all
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId(`q${i}-yes`))
    }

    expect(screen.queryByTestId('result-card')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('see-result-btn'))

    expect(screen.getByTestId('result-card')).toBeInTheDocument()
  })

  it('disclaimer text renders below result', () => {
    render(<IlpQuiz />)

    // Answer all and show result
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId(`q${i}-yes`))
    }
    fireEvent.click(screen.getByTestId('see-result-btn'))

    const disclaimer = screen.getByTestId('disclaimer')
    expect(disclaimer.textContent).toBe(QUIZ_DISCLAIMER)
  })
})

// ─── Canvas rendering ──────────────────────────────────────────────────────

describe('renderResultCanvas', () => {
  it('draws score and result text on canvas', () => {
    const fillTextCalls: Array<{ text: string; x: number; y: number }> = []
    const fillRectCalls: Array<{ x: number; y: number; w: number; h: number }> = []

    const mockCtx = {
      createLinearGradient: () => ({
        addColorStop: vi.fn(),
      }),
      fillRect: (x: number, y: number, w: number, h: number) => {
        fillRectCalls.push({ x, y, w, h })
      },
      fillText: (text: string, x: number, y: number) => {
        fillTextCalls.push({ text, x, y })
      },
      measureText: (text: string) => ({ width: text.length * 8 }),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    }

    const canvas = {
      width: 600,
      height: 400,
      getContext: () => mockCtx,
    } as unknown as HTMLCanvasElement

    renderResultCanvas(canvas, 5, 'Test result text here.', SITE_URL)

    // Verify title was drawn
    const titleCall = fillTextCalls.find((c) =>
      c.text === 'ILP Information Checklist'
    )
    expect(titleCall).toBeDefined()

    // Verify score was drawn
    const scoreCall = fillTextCalls.find((c) => c.text === '5/6')
    expect(scoreCall).toBeDefined()

    // Verify result text was drawn (word-wrapped, so check any part)
    const resultCalls = fillTextCalls.filter((c) =>
      c.text.includes('Test') || c.text.includes('result') || c.text.includes('here')
    )
    expect(resultCalls.length).toBeGreaterThan(0)

    // Verify branding was drawn
    const brandingCall = fillTextCalls.find((c) => c.text === SITE_URL)
    expect(brandingCall).toBeDefined()

    // Verify background was drawn (full canvas rect)
    expect(fillRectCalls).toContainEqual({ x: 0, y: 0, w: 600, h: 400 })
  })
})

// ─── Share fallback ────────────────────────────────────────────────────────

describe('Share fallback', () => {
  const originalShare = navigator.share
  const originalClipboard = navigator.clipboard
  const originalCreateElement = document.createElement.bind(document)

  // Mock canvas for share tests (jsdom does not implement canvas)
  function mockCanvasCreation() {
    const pngBlob = new Blob(['fake-png'], { type: 'image/png' })
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const fakeCanvas = originalCreateElement('canvas')
        Object.defineProperty(fakeCanvas, 'getContext', {
          value: () => ({
            createLinearGradient: () => ({ addColorStop: vi.fn() }),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            measureText: () => ({ width: 50 }),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillStyle: '',
            font: '',
            textAlign: '',
            textBaseline: '',
          }),
        })
        Object.defineProperty(fakeCanvas, 'toBlob', {
          value: (cb: BlobCallback) => cb(pngBlob),
        })
        return fakeCanvas
      }
      return originalCreateElement(tag)
    })
  }

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    })
  })

  it('when navigator.share is available, it is called with a File', async () => {
    mockCanvasCreation()

    const shareFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', {
      value: shareFn,
      writable: true,
      configurable: true,
    })

    render(<IlpQuiz />)

    // Answer all and show result
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId(`q${i}-yes`))
    }
    fireEvent.click(screen.getByTestId('see-result-btn'))
    fireEvent.click(screen.getByTestId('share-btn'))

    // Wait for async share to complete
    await screen.findByTestId('share-status')

    expect(shareFn).toHaveBeenCalledTimes(1)
    const callArg = shareFn.mock.calls[0][0]
    expect(callArg.files).toHaveLength(1)
    expect(callArg.files[0]).toBeInstanceOf(File)
    expect(callArg.files[0].name).toBe('ilp-quiz-result.png')
  })

  it('when navigator.share is undefined and clipboard.write throws, download fallback is triggered', async () => {
    // No Web Share
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    // Clipboard fails (provide ClipboardItem so the branch is entered, then write throws)
    const originalClipboardItem = globalThis.ClipboardItem
    class MockClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).ClipboardItem = MockClipboardItem

    Object.defineProperty(navigator, 'clipboard', {
      value: { write: vi.fn().mockRejectedValue(new Error('clipboard denied')) },
      writable: true,
      configurable: true,
    })

    // Mock URL.createObjectURL / revokeObjectURL
    const fakeUrl = 'blob:fake-url'
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeUrl)
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    // Capture the anchor element; handle canvas in the same spy so there is
    // only one mock installed on document.createElement at a time.
    let capturedAnchor: HTMLAnchorElement | null = null
    const clickSpy = vi.fn()
    const pngBlob = new Blob(['fake-png'], { type: 'image/png' })

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        const fakeCanvas = originalCreateElement('canvas')
        Object.defineProperty(fakeCanvas, 'getContext', {
          value: () => ({
            createLinearGradient: () => ({ addColorStop: vi.fn() }),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            measureText: () => ({ width: 50 }),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillStyle: '',
            font: '',
            textAlign: '',
            textBaseline: '',
          }),
        })
        Object.defineProperty(fakeCanvas, 'toBlob', {
          value: (cb: BlobCallback) => cb(pngBlob),
        })
        return fakeCanvas
      }
      if (tag === 'a') {
        const anchor = originalCreateElement('a') as HTMLAnchorElement
        anchor.click = clickSpy
        capturedAnchor = anchor
        return anchor
      }
      return originalCreateElement(tag)
    })

    render(<IlpQuiz />)

    // Answer all and show result
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId(`q${i}-yes`))
    }
    fireEvent.click(screen.getByTestId('see-result-btn'))
    fireEvent.click(screen.getByTestId('share-btn'))

    // Wait for async flow to complete
    await screen.findByTestId('share-status')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    if (!capturedAnchor) throw new Error('anchor element was never created')
    expect(capturedAnchor.download).toBe('ilp-quiz-result.png')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(fakeUrl)
    expect(screen.getByTestId('share-status').textContent).toBe('Image downloaded!')

    // Restore ClipboardItem
    if (originalClipboardItem) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).ClipboardItem = originalClipboardItem
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).ClipboardItem
    }
  })

  it('when navigator.share is not available, clipboard.write is called', async () => {
    mockCanvasCreation()

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    // jsdom does not define ClipboardItem, so provide a mock
    const originalClipboardItem = globalThis.ClipboardItem
    class MockClipboardItem {
      types: string[]
      constructor(public items: Record<string, Blob>) {
        this.types = Object.keys(items)
      }
      getType(type: string) {
        return Promise.resolve(this.items[type])
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).ClipboardItem = MockClipboardItem

    const writeFn = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeFn },
      writable: true,
      configurable: true,
    })

    render(<IlpQuiz />)

    // Answer all and show result
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId(`q${i}-yes`))
    }
    fireEvent.click(screen.getByTestId('see-result-btn'))
    fireEvent.click(screen.getByTestId('share-btn'))

    // Wait for async clipboard to complete
    await screen.findByTestId('share-status')

    expect(writeFn).toHaveBeenCalledTimes(1)
    const clipboardItems = writeFn.mock.calls[0][0]
    expect(clipboardItems).toHaveLength(1)
    expect(clipboardItems[0]).toBeInstanceOf(MockClipboardItem)

    // Restore original
    if (originalClipboardItem) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).ClipboardItem = originalClipboardItem
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).ClipboardItem
    }
  })
})
