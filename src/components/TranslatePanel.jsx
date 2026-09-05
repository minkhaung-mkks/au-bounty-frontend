import { useState } from 'react'
import { api } from '../api.js'
import { Icon, Kicker } from './ui.jsx'

/** D10's five languages; the API takes any two-letter code, the UI keeps a curated set. */
const LANGS = [
  { code: 'th', label: 'Thai' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
]

/**
 * Title + content of a post in another language. Mounted only when /meta
 * reports capabilities.translation, so an unkeyed server never shows it. The
 * API's identity fallback keeps the response shape identical, which is why
 * `translated: false` renders as a note instead of an error. Results are
 * cached per language in component state (parents key this panel by task id,
 * so the cache dies with the task).
 */
export function TranslatePanel({ taskId, title, content }) {
  const [lang, setLang] = useState('th')
  const [cache, setCache] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showOriginal, setShowOriginal] = useState(false)

  const result = cache[lang] ?? null

  const translate = async () => {
    if (busy) return
    if (result) {
      setShowOriginal(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.post(`/tasks/${taskId}/translate?lang=${lang}`)
      setCache((c) => ({ ...c, [lang]: res }))
      setShowOriginal(false)
    } catch (err) {
      setError(err?.message || 'Translation failed.')
    } finally {
      setBusy(false)
    }
  }

  // With translated:false the panel shows the original texts anyway, so the
  // toggle would compare identical strings; it appears only for real results.
  const showingOriginal = !result || result.translated === false || showOriginal
  const shownTitle = showingOriginal ? title : result.title
  const shownContent = showingOriginal ? content : result.content

  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Kicker>TRANSLATE</Kicker>
      <div style={{ display: 'flex', gap: 9 }}>
        <select
          className="field"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label="Translate to"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ flex: '0 0 auto' }}
          onClick={translate}
          disabled={busy}
        >
          <Icon name="translate" size={16} color="var(--red)" />
          {busy ? 'Translating…' : 'Translate'}
        </button>
      </div>

      {error ? (
        <div role="alert" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }}>
          {error}
        </div>
      ) : null}

      {result ? (
        <div
          className="divider"
          style={{ paddingTop: 13, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {result.translated === false ? (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--gold-ink)',
                background: 'var(--gold-wash)',
                padding: '8px 11px',
              }}
            >
              Translation is unavailable right now. Showing the original text.
            </div>
          ) : null}
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15.5 }}>
            {shownTitle}
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-4)', margin: 0 }}>
            {shownContent}
          </p>
          {result.translated !== false ? (
            <button
              type="button"
              className="btn btn-link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setShowOriginal((s) => !s)}
            >
              {showOriginal ? 'Show translation' : 'Show original'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
