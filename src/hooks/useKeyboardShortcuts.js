import { useState, useEffect, useCallback } from 'react'

export default function useKeyboardShortcuts({ inputRef, visibleTabs, activeTab, setActiveTab }) {
  const [showHelp, setShowHelp] = useState(false)

  const handleKeyDown = useCallback(
    (e) => {
      const tag = e.target.tagName
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable

      // "/" focuses search from anywhere
      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        inputRef?.current?.focus()
        return
      }

      // Escape blurs search
      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false)
          return
        }
        if (document.activeElement === inputRef?.current) {
          inputRef.current.blur()
          return
        }
      }

      if (isTyping) return

      // "?" toggles help
      if (e.key === '?') {
        setShowHelp((prev) => !prev)
        return
      }

      // 1-9 for tab switching
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= 9 && visibleTabs?.length) {
        const tab = visibleTabs[num - 1]
        if (tab) {
          setActiveTab(tab.id)
          return
        }
      }

      // Arrow keys for tab navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!visibleTabs?.length) return
        const currentIdx = visibleTabs.findIndex((t) => t.id === activeTab)
        if (currentIdx === -1) return
        const delta = e.key === 'ArrowLeft' ? -1 : 1
        const nextIdx = Math.max(0, Math.min(visibleTabs.length - 1, currentIdx + delta))
        if (nextIdx !== currentIdx) {
          setActiveTab(visibleTabs[nextIdx].id)
        }
      }
    },
    [inputRef, visibleTabs, activeTab, setActiveTab, showHelp],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { showHelp, setShowHelp }
}
