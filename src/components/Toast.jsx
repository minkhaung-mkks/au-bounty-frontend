import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Icon } from './ui.jsx'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const flash = useCallback((message, kind = 'ok') => {
    clearTimeout(timer.current)
    setToast({ message, kind })
    timer.current = setTimeout(() => setToast(null), 3400)
  }, [])

  // Every failed request lands here, so no error is swallowed silently.
  const flashError = useCallback((err) => flash(err?.message || 'Request failed.', 'error'), [flash])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <ToastContext.Provider value={{ flash, flashError }}>
      {children}
      {toast ? (
        <div className={toast.kind === 'error' ? 'toast toast-error' : 'toast'} role="status">
          <Icon
            className={toast.kind === 'error' ? undefined : 'seal'}
            name={toast.kind === 'error' ? 'error' : 'check_circle'}
            color={toast.kind === 'error' ? '#fff' : 'var(--gold-light)'}
          />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
