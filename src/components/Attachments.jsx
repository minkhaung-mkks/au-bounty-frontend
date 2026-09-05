import { useRef, useState } from 'react'
import { useToast } from './Toast.jsx'
import { Icon } from './ui.jsx'
import { ACCEPT_SELECTOR, attachmentIcon, downloadAttachment, formatBytes } from '../lib/uploads.js'

/**
 * The shared attachment UI: the attach trigger, the chip an uploaded file
 * renders as (download + optional delete), and the row an in-flight or failed
 * upload renders as (progress + retry). TaskDetail, EventDetail and Messages
 * all speak this vocabulary; only the surrounding layout differs.
 */

/** A plain button that owns a hidden file input. No drag-and-drop theater. */
export function AttachButton({
  onPicked,
  label = 'Attach a file',
  className = 'btn btn-outline btn-sm',
  disabled = false,
  multiple = true,
}) {
  const inputRef = useRef(null)
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="attach_file" size={16} />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_SELECTOR}
        multiple={multiple}
        hidden
        aria-label={label}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onPicked(files)
          // Reset so picking the same file again still fires onChange.
          e.target.value = ''
        }}
      />
    </>
  )
}

/**
 * One attached file: icon by mime, name, size, download. `onDelete` (uploader/
 * admin only, by the time it reaches here) returns a promise; the chip handles
 * its own confirm step and busy state so callers stay one-liners.
 */
export function AttachmentChip({ attachment, onDelete, onRed = false }) {
  const { flashError } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const download = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadAttachment(attachment)
    } catch (err) {
      flashError(err)
    } finally {
      setDownloading(false)
    }
  }

  const remove = async () => {
    if (deleting || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(attachment)
    } catch (err) {
      flashError(err)
      setDeleting(false)
    }
  }

  return (
    <span className="attach-wrap">
      <span className={`attach-chip${onRed ? ' on-red' : ''}`}>
        <Icon name={attachmentIcon(attachment.mimeType)} size={17} color={onRed ? '#fff' : 'var(--red)'} />
        <span className="attach-name" title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <span className="attach-size">{formatBytes(attachment.sizeBytes)}</span>
        <button
          type="button"
          className="attach-act"
          onClick={download}
          disabled={downloading}
          title="Download"
          aria-label={`Download ${attachment.fileName}`}
        >
          <Icon name={downloading ? 'progress_activity' : 'download'} size={16} />
        </button>
        {onDelete ? (
          <button
            type="button"
            className="attach-act"
            onClick={() => setConfirming(true)}
            title="Remove"
            aria-label={`Remove ${attachment.fileName}`}
          >
            <Icon name="delete" size={16} />
          </button>
        ) : null}
      </span>
      {confirming ? (
        <span className="attach-confirm">
          <span>Remove {attachment.fileName}?</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={deleting} onClick={remove}>
            {deleting ? 'Removing…' : 'Remove'}
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={deleting} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </span>
      ) : null}
    </span>
  )
}

/** The attachments[] block of a task, event or message, as download chips. */
export function AttachmentChips({ attachments, onDelete, onRed = false }) {
  if (!attachments?.length) return null
  return (
    <span className="attach-list">
      {attachments.map((a) => (
        <AttachmentChip key={a.id} attachment={a} onDelete={onDelete} onRed={onRed} />
      ))}
    </span>
  )
}

/**
 * One upload in flight (thin progress bar) or failed (reason + retry). The
 * caller owns the upload lifecycle; this only renders state it is handed.
 */
export function UploadRow({ name, size, progress, error, onRetry, onRemove }) {
  return (
    <div className="attach-row">
      <Icon name="upload_file" size={17} color={error ? 'var(--red)' : 'var(--muted-2)'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="attach-name" title={name}>
          {name}
          <span className="attach-size" style={{ marginLeft: 7 }}>
            {formatBytes(size)}
          </span>
        </div>
        {error ? (
          <div className="attach-error">{error}</div>
        ) : (
          <div className="attach-bar">
            <div className="attach-bar-fill" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
        )}
      </div>
      {error ? (
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
            Retry
          </button>
          <button type="button" className="attach-act" onClick={onRemove} title="Dismiss" aria-label={`Dismiss ${name}`}>
            <Icon name="close" size={16} />
          </button>
        </>
      ) : (
        <span className="attach-size" style={{ fontSize: 11.5 }}>
          {Math.round((progress ?? 0) * 100)}%
        </span>
      )}
    </div>
  )
}
