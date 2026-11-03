import { describe, expect, test } from 'bun:test'
import { sanitizeHtml } from '@/lib/sanitize'

describe('sanitizeHtml', () => {
  test('removes scripts and event handler attributes', () => {
    const html = '<p onclick="alert(1)">本文<script>alert(1)</script></p>'
    expect(sanitizeHtml(html)).toBe('<p>本文</p>')
  })

  test('keeps links including target and rel', () => {
    const html =
      '<p>「<a href="https://example.com/" target="_blank" rel="noopener noreferrer nofollow">リンク</a>」<br>2行目</p>'
    expect(sanitizeHtml(html)).toBe(html)
  })
})
