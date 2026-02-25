import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '../http/retry'
import { ServerError } from '../errors'

class FakeHttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('withRetry', () => {
  it('returns result on successful first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true })
    const result = await withRetry(fn, '/test')
    expect(result).toEqual({ ok: true })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 503 and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new FakeHttpError(503, 'Service Unavailable'))
      .mockResolvedValueOnce({ data: 'ok' })

    const promise = withRetry(fn, '/test', { baseDelay: 100, maxDelay: 1000 })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual({ data: 'ok' })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('waits at least retryAfter seconds when 429 is returned', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new FakeHttpError(429, 'Rate limited', 5))
      .mockResolvedValueOnce({ data: 'ok' })

    let resolved = false
    const promise = withRetry(fn, '/test').then((v) => {
      resolved = true
      return v
    })

    // advance less than 5000ms — should not have resolved yet
    await vi.advanceTimersByTimeAsync(4999)
    expect(resolved).toBe(false)

    // now advance past 5000ms
    await vi.advanceTimersByTimeAsync(2)
    await promise
    expect(resolved).toBe(true)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('fires onRateLimit callback with correct info on 429', async () => {
    const onRateLimit = vi.fn()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new FakeHttpError(429, 'Rate limited', 5))
      .mockResolvedValueOnce({ ok: true })

    const promise = withRetry(fn, '/listings', {
      onRateLimit,
    })
    await vi.runAllTimersAsync()
    await promise

    expect(onRateLimit).toHaveBeenCalledOnce()
    expect(onRateLimit).toHaveBeenCalledWith({
      retryAfter: 5,
      endpoint: '/listings',
      attempt: 1,
    })
  })

  it('does not retry on non-retryable 4xx errors', async () => {
    const fn = vi.fn().mockRejectedValue(new FakeHttpError(404, 'Not found'))
    await expect(withRetry(fn, '/test')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Not found',
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws ServerError with attempts=4 after maxAttempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new FakeHttpError(503, 'Service Unavailable'))

    const promise = withRetry(fn, '/test', { maxAttempts: 4, baseDelay: 100, maxDelay: 1000 })
    // Attach rejection handler immediately to avoid unhandled rejection warning
    const caught = promise.catch((err: unknown) => err)

    await vi.runAllTimersAsync()
    const err = await caught

    expect(err).toBeInstanceOf(ServerError)
    expect((err as ServerError).attempts).toBe(4)
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('applies jitter so two retries of the same 500 error get different delays', async () => {
    const delays: number[] = []

    // Spy on setTimeout to capture delay values
    const realSetTimeout = globalThis.setTimeout
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: () => void, delay?: number) => {
      delays.push(delay ?? 0)
      return realSetTimeout(cb, 0)
    })

    const makeError = () => new FakeHttpError(500, 'Internal Server Error')

    // First run
    const fn1 = vi
      .fn()
      .mockRejectedValueOnce(makeError())
      .mockResolvedValueOnce('ok')

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9)
    const p1 = withRetry(fn1, '/test', { maxAttempts: 2, baseDelay: 1000, maxDelay: 60_000 })
    await vi.runAllTimersAsync()
    await p1

    const delay1 = delays[0]

    delays.length = 0

    // Second run with different random value
    const fn2 = vi
      .fn()
      .mockRejectedValueOnce(makeError())
      .mockResolvedValueOnce('ok')

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1)
    const p2 = withRetry(fn2, '/test', { maxAttempts: 2, baseDelay: 1000, maxDelay: 60_000 })
    await vi.runAllTimersAsync()
    await p2

    const delay2 = delays[0]

    expect(delay1).not.toBe(delay2)
  })
})
