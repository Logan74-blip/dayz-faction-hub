import { useState, useCallback } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const success = useCallback((msg) => toast(msg, 'success'), [toast])
  const error = useCallback((msg) => toast(msg, 'error'), [toast])
  const info = useCallback((msg) => toast(msg, 'info'), [toast])
  const warning = useCallback((msg) => toast(msg, 'warning'), [toast])

  function ToastContainer() {
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' }
    return (
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{icons[t.type]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    )
  }

  return { toast, success, error, info, warning, ToastContainer }
}