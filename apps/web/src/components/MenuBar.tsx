import { useEffect, useRef, useState, type ReactNode } from 'react'

type MenuItem =
  | { kind: 'item'; id: string; label: string; shortcut?: string; disabled?: boolean; onClick: () => void }
  | { kind: 'sep' }

type MenuDef = {
  id: string
  label: string
  items: MenuItem[]
}

type Props = {
  menus: MenuDef[]
  trailing?: ReactNode
}

/** Simple application menu bar (File / Edit / …). */
export function MenuBar({ menus, trailing }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenId(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="menubar" ref={rootRef} role="menubar">
      {menus.map((menu) => (
        <div key={menu.id} className={`menubar-item ${openId === menu.id ? 'open' : ''}`}>
          <button
            type="button"
            className="menubar-trigger"
            aria-haspopup="true"
            aria-expanded={openId === menu.id}
            onClick={() => setOpenId((id) => (id === menu.id ? null : menu.id))}
            onMouseEnter={() => {
              if (openId) setOpenId(menu.id)
            }}
          >
            {menu.label}
          </button>
          {openId === menu.id && (
            <div className="menubar-dropdown" role="menu">
              {menu.items.map((item, i) =>
                item.kind === 'sep' ? (
                  <div key={`sep-${i}`} className="menubar-sep" />
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className="menubar-option"
                    onClick={() => {
                      setOpenId(null)
                      item.onClick()
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <kbd>{item.shortcut}</kbd>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
      <div className="menubar-trailing">{trailing}</div>
    </div>
  )
}
