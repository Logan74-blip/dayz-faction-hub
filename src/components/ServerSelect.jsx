import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

export default function ServerSelect({ value, onChange }) {
  const [servers, setServers] = useState([])
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    supabase.from('servers').select('name').order('name').then(({ data }) => setServers(data?.map(s => s.name) || []))
  }, [])

  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); return }
    const matches = servers.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    setSuggestions(matches.slice(0, 8))
  }, [query, servers])

  useEffect(() => {
    function handleClick(e) { if (!ref.current?.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(name) {
    setQuery(name)
    onChange(name)
    setShowDropdown(false)
  }

  function handleChange(e) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setShowDropdown(true)
  }

  async function addCustomServer(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    await supabase.from('servers').insert({ name: trimmed }).then(() => {
      setServers(s => [...s, trimmed].sort())
    })
    select(trimmed)
  }

  const exactMatch = servers.some(s => s.toLowerCase() === query.toLowerCase())

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        placeholder="Search or enter server name..."
        value={query}
        onChange={handleChange}
        onFocus={() => setShowDropdown(true)}
      />
      {showDropdown && (suggestions.length > 0 || (!exactMatch && query.length > 1)) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: '#111812', border: '1px solid var(--border)',
          borderRadius: '4px', marginTop: '2px', maxHeight: '200px', overflowY: 'auto'
        }}>
          {suggestions.map(s => (
            <div key={s} onClick={() => select(s)} style={{
              padding: '8px 12px', cursor: 'pointer', fontSize: '14px',
              borderBottom: '1px solid var(--border)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a2e1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {s}
            </div>
          ))}
          {!exactMatch && query.trim().length > 1 && (
            <div onClick={() => addCustomServer(query)} style={{
              padding: '8px 12px', cursor: 'pointer', fontSize: '14px',
              color: 'var(--green)', fontWeight: 600,
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a2e1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              + Add "{query.trim()}" as new server
            </div>
          )}
        </div>
      )}
    </div>
  )
}