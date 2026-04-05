import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { VERSION } from '../index'

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'))

describe('package', () => {
  it('VERSION matches package.json version', () => {
    expect(VERSION).toBe(pkg.version)
  })
})
