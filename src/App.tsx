import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  ChangeEvent as ReactChangeEvent,
} from 'react';
import { Plus, Trash2, Palette, ChevronUp, ChevronDown } from 'lucide-react';

const PRESET_COLORS = [
  '#fef3c7', '#fef08a', '#fde047', '#facc15', '#eab308',
  '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6',
  '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899',
  '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e',
  '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1',
  '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c',
  '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626',
  '#d9f99d', '#bef264', '#a3e635', '#84cc16', '#65a30d',
  '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea',
  '#fef9c3', '#fef08a', '#fde047', '#fcd34d', '#fbbf24'
];

type Note = {
  id: string;
  text: string;
  color: string;
  width: string;
  height: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: number;
  markdown: boolean;
  children: Note[];
};

type NoteSquareProps = {
  note: Note;
  onUpdate: (id: string, updated: Note) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onShowContextMenu?: (x: number, y: number, noteId: string) => void;
  onHideContextMenu?: () => void;
  openColorPickerNoteId: string | null;
  setOpenColorPickerNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  depth?: number;
};

const NoteSquare: React.FC<NoteSquareProps> = ({
  note,
  onUpdate,
  onDelete,
  onAddChild,
  onShowContextMenu,
  onHideContextMenu,
  openColorPickerNoteId,
  setOpenColorPickerNoteId,
  depth = 0,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; noteX: number; noteY: number }>({
    x: 0,
    y: 0,
    noteX: 0,
    noteY: 0,
  });
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const usedColors = PRESET_COLORS;
  const showColorPicker = openColorPickerNoteId === note.id;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const noteRef = useRef<HTMLDivElement | null>(null);
  const [showTextMenu, setShowTextMenu] = useState(false);
  const suppressNextContextMenuRef = useRef(false);

  useEffect(() => {
    const handler = () => setShowTextMenu(false);
    document.addEventListener('closeTextMenus', handler);
    return () => document.removeEventListener('closeTextMenus', handler);
  }, []);

  // --- Lightweight Markdown support (no external deps) ---
  const escapeHtml = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const processInline = (s: string) => {
    // inline code first
    s = s.replace(
      /`([^`]+)`/g,
      (_m: string, code: string) =>
        `<code class="px-1 py-0.5 bg-black/10 rounded">${escapeHtml(code)}</code>`,
    );
    // bold
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // italic (single *)
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m: string, text: string, url: string) => {
      const safe = /^https?:\/\//i.test(url) ? url : '#';
      const label = escapeHtml(text);
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-blue-700 underline">${label}</a>`;
    });
    return s;
  };

  const markdownToHtml = (input: string) => {
    if (!input) return '';
    const lines = String(input).split(/\r?\n/);
    let html = '';
    let inUL = false;
    let inOL = false;
    let i = 0;

    const flushLists = () => {
      if (inUL) { html += '</ul>'; inUL = false; }
      if (inOL) { html += '</ol>'; inOL = false; }
    };

    while (i < lines.length) {
      let line = lines[i];
      // code block ```
      if (/^\s*```/.test(line)) {
        flushLists();
        i++;
        let code = '';
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          code += (code ? '\n' : '') + lines[i];
          i++;
        }
        html += `<pre class="bg-black/10 rounded p-2 overflow-auto"><code>${escapeHtml(code)}</code></pre>`;
        i++; // skip closing ```
        continue;
      }

      // headings
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flushLists();
        const level = h[1].length;
        html += `<h${level} class="font-semibold mt-1 mb-1">${processInline(escapeHtml(h[2]))}</h${level}>`;
        i++;
        continue;
      }

      // unordered list
      if (/^\s*[-*]\s+/.test(line)) {
        if (!inUL) { flushLists(); html += '<ul class="list-disc ml-5">'; inUL = true; }
        html += `<li>${processInline(escapeHtml(line.replace(/^\s*[-*]\s+/, '')))}</li>`;
        i++;
        continue;
      }

      // ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        if (!inOL) { flushLists(); html += '<ol class="list-decimal ml-5">'; inOL = true; }
        html += `<li>${processInline(escapeHtml(line.replace(/^\s*\d+\.\s+/, '')))}</li>`;
        i++;
        continue;
      }

      // empty line => paragraph break
      if (/^\s*$/.test(line)) {
        flushLists();
        html += '<br />';
        i++;
        continue;
      }

      // paragraph
      flushLists();
      html += `<p>${processInline(escapeHtml(line))}</p>`;
      i++;
    }
    flushLists();
    return html;
  };

  const handleDragStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement)) return;
    const target = e.target;
    // Do not start dragging when interacting with UI controls or while editing text
    if (
      target.tagName === 'BUTTON' ||
      target.closest('.color-picker') ||
      target.closest('.resize-handle') ||
      isEditing ||
      target.tagName === 'TEXTAREA' ||
      target.closest('.note-content')
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onHideContextMenu?.();
    // If right-click closed any overlay here, suppress the upcoming contextmenu
    const hadColor = openColorPickerNoteId !== null;
    const hadText = showTextMenu;
    if (hadColor) setOpenColorPickerNoteId(null);
    if (hadText) setShowTextMenu(false);
    if (e.button === 2 && (hadColor || hadText)) {
      suppressNextContextMenuRef.current = true;
    }
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      noteX: note.x || 0,
      noteY: note.y || 0
    });
  };

  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement)) return;
    const target = e.target;
    if (target.tagName === 'BUTTON' || 
        target.closest('.color-picker') ||
        target.closest('.resize-handle')) {
      return;
    }
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    onHideContextMenu?.();
    setShowTextMenu(false);
    setOpenColorPickerNoteId(null);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    let newX = Math.max(0, dragStart.noteX + deltaX);
    let newY = Math.max(0, dragStart.noteY + deltaY);
    
    onUpdate(note.id, { ...note, x: newX, y: newY });
  };

  const handleResizeStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onHideContextMenu?.();
    setOpenColorPickerNoteId(null);
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: parseInt(note.width) || 280,
      height: parseInt(note.height) || 180
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    // Reduce minimum note size by half (width: 100px, height: 75px)
    const newWidth = Math.max(100, resizeStart.width + deltaX);
    const newHeight = Math.max(75, resizeStart.height + deltaY);
    
    onUpdate(note.id, { ...note, width: `${newWidth}px`, height: `${newHeight}px` });
  };

  useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent) => handleDragMove(e);
      const handleUp = () => setIsDragging(false);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (isResizing) {
      const handleMove = (e: MouseEvent) => handleResizeMove(e);
      const handleUp = () => setIsResizing(false);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isResizing, resizeStart]);

  const handleColorChange = (color: string) => {
    onUpdate(note.id, { ...note, color });
    // Keep palette positions stable and close after selection
    setOpenColorPickerNoteId(null);
  };

  const handleTextChange = (e: ReactChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(note.id, { ...note, text: e.target.value });
  };

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onHideContextMenu?.();
    if (suppressNextContextMenuRef.current) {
      suppressNextContextMenuRef.current = false;
      return;
    }
    // Determine if anything is open anywhere: color menu, text menu, or editing
    const anyColorMenuOpen =
      !!document.querySelector('.color-picker') ||
      openColorPickerNoteId !== null ||
      showColorPicker;
    const anyTextMenuOpen = showTextMenu || !!document.querySelector('.text-menu');
    const active = document.activeElement;
    const anyEditing = isEditing || (active instanceof HTMLTextAreaElement);

    if (anyColorMenuOpen || anyTextMenuOpen || anyEditing) {
      // Close all overlays and exit editing
      setOpenColorPickerNoteId(null);
      setShowTextMenu(false);
      try { document.dispatchEvent(new Event('closeTextMenus')); } catch(_) {}
      if (isEditing) setIsEditing(false);
      if (active instanceof HTMLElement) active.blur();
      return; // do not open context menu
    }

    // Otherwise open the Add Child menu for this note
    onShowContextMenu?.(e.clientX, e.clientY, note.id);
  };

  return (
    <div
      ref={noteRef}
      className="border rounded absolute select-none"
      style={{
        backgroundColor: note.color,
        width: note.width || '280px',
        height: note.height || '180px',
        left: `${note.x || 0}px`,
        top: `${note.y || 0}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onContextMenu={handleContextMenu}
      onMouseDown={handleDragStart}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex justify-between items-center p-2 border-b border-gray-400/30">
        <div className="flex gap-0 items-center">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHideContextMenu?.();
                setShowTextMenu(false);
                setOpenColorPickerNoteId(showColorPicker ? null : note.id);
              }}
              className="px-0.5 py-0.5 rounded cursor-pointer text-gray-700 hover:text-white transition-colors transition-transform duration-150 hover:scale-110 active:scale-95"
              title="Change color"
            >
              <Palette size={14} />
            </button>
            {showColorPicker && (
              <div
                className="color-picker absolute top-8 left-0 bg-white border-2 border-gray-300 rounded p-3 shadow-lg z-50 grid grid-cols-10 gap-2"
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenColorPickerNoteId(null);
                  onHideContextMenu?.();
                }}
              >
                {usedColors.map(color => (
                  <div
                    key={color}
                    className="w-8 h-8 rounded cursor-pointer border-2 border-gray-400 hover:scale-110 hover:border-gray-600"
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                    title={color}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Text formatting popover via T */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHideContextMenu?.();
                setOpenColorPickerNoteId(null);
                // toggle local text menu
                setShowTextMenu((v) => !v);
              }}
              className="px-0.5 py-0.5 rounded cursor-pointer text-gray-700 hover:text-white transition-colors transition-transform duration-150 hover:scale-110 active:scale-95"
              title="Text options"
            >
              T
            </button>
            {showTextMenu && (
              <div
                className="text-menu absolute top-7 left-0 bg-transparent p-1 z-50 flex gap-0"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <button
                  className="px-0.5 py-0.5 text-[12px] text-gray-700 hover:text-white transition-colors transition-transform duration-150 hover:scale-110 active:scale-95"
                  title="Smaller text"
                  onClick={() => {
                    const size = Math.max(10, (note.fontSize || 14) - 2);
                    onUpdate(note.id, { ...note, fontSize: size });
                  }}
                >
                  <ChevronDown size={12} />
                </button>
                <button
                  className="px-0.5 py-0.5 text-[12px] text-gray-700 hover:text-white transition-colors transition-transform duration-150 hover:scale-110 active:scale-95"
                  title="Larger text"
                  onClick={() => {
                    const size = Math.min(32, (note.fontSize || 14) + 2);
                    onUpdate(note.id, { ...note, fontSize: size });
                  }}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  className="px-0.5 py-0.5 text-[12px] font-bold text-gray-700 hover:text-white transition-colors transition-transform duration-150 hover:scale-110 active:scale-95"
                  title="Bold"
                  onClick={() => {
                    const next = (note.fontWeight || 400) >= 600 ? 400 : 700;
                    onUpdate(note.id, { ...note, fontWeight: next });
                  }}
                >
                  B
                </button>
                <button
                  className={`px-0.5 py-0.5 text-[12px] font-semibold transition-colors transition-transform duration-150 hover:scale-110 active:scale-95 ${ (note.markdown ?? true) ? 'text-white' : 'text-gray-700 hover:text-white'}`}
                  title="Toggle Markdown preview"
                  onClick={() => {
                    onUpdate(note.id, { ...note, markdown: !(note.markdown ?? true) });
                  }}
                >
                  MD
                </button>
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHideContextMenu?.();
              setOpenColorPickerNoteId(null);
              setShowTextMenu(false);
              onAddChild(note.id);
            }}
            className="px-0.5 py-0.5 rounded cursor-pointer text-gray-700 hover:text-white transition-colors transition-transform duration-150 hover:scale-110 active:scale-95"
            title="Add child"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHideContextMenu?.();
              setOpenColorPickerNoteId(null);
              setShowTextMenu(false);
              onDelete(note.id);
            }}
            className="px-0.5 py-0.5 rounded cursor-pointer text-gray-700 hover:text-white transition-colors transition-transform duration-150 hover:scale-110 active:scale-95"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div 
        className="note-content p-2 relative"
        style={{ 
          height: `calc(100% - 38px)`, 
          overflow: 'hidden',
          pointerEvents: isEditing ? 'auto' : 'none'
        }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={note.text}
            onChange={handleTextChange}
            onBlur={() => setIsEditing(false)}
            onDoubleClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpenColorPickerNoteId(null);
              onHideContextMenu?.();
              setIsEditing(false);
            }}
            onMouseUp={(e) => {
              // Handle triple and quadruple click selections while editing
              const ta = textareaRef.current;
              if (!ta) return;
              const clicks = e.detail;
              if (clicks >= 4) {
                // Quadruple click: select entire text
                ta.setSelectionRange(0, ta.value.length);
                return;
              }
              if (clicks === 3) {
                // Triple click: select sentence around the click
                const text = ta.value;
                // Use current selection as anchor (center) to infer click position
                const anchor = Math.floor((ta.selectionStart + ta.selectionEnd) / 2);
                // Find sentence start (after previous . ! ? or newline)
                let start = anchor;
                while (start > 0 && !(/[.!?\n]/.test(text[start - 1]))) start--;
                while (start < text.length && text[start] === ' ') start++;
                // Find sentence end (next . ! ? or newline), include punctuation
                let end = anchor;
                while (end < text.length && !(/[.!?\n]/.test(text[end]))) end++;
                if (end < text.length && /[.!?]/.test(text[end])) end++;
                ta.setSelectionRange(start, end);
              }
            }}
            className="w-full h-full p-1 resize-none border-none outline-none"
            placeholder="Type here..."
            style={{ 
              backgroundColor: 'transparent',
              color: 'inherit',
              fontSize: `${note.fontSize || 14}px`,
              fontWeight: note.fontWeight || 400,
            }}
          />
        ) : (
          (note.markdown ?? true) ? (
            <div
              className="w-full h-full p-1 overflow-auto"
              style={{ fontSize: `${note.fontSize || 14}px`, fontWeight: note.fontWeight || 400 }}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(note.text) }}
            />
          ) : (
            <div
              className="w-full h-full p-1 whitespace-pre-wrap"
              style={{ fontSize: `${note.fontSize || 14}px`, fontWeight: note.fontWeight || 400 }}
            >
              {note.text || 'Double-click to edit'}
            </div>
          )
        )}
      </div>

      {note.children && note.children.length > 0 && (
        <div className="absolute inset-0" style={{ top: '38px', pointerEvents: 'none' }}>
          <div className="relative w-full h-full">
            {note.children.map((child) => (
              <div key={child.id} style={{ pointerEvents: 'auto' }}>
                <NoteSquare
                  note={child}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAddChild={onAddChild}
                  onShowContextMenu={onShowContextMenu}
                  onHideContextMenu={onHideContextMenu}
                  openColorPickerNoteId={openColorPickerNoteId}
                  setOpenColorPickerNoteId={setOpenColorPickerNoteId}
                  depth={depth + 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="resize-handle absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize hover:bg-black/20 flex items-end justify-end pointer-events-auto"
        onMouseDown={handleResizeStart}
      >
        <div className="w-4 h-4 border-r border-b border-gray-600 mb-0.5 mr-0.5" />
      </div>
    </div>
  );
};

export default function App() {
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      text: 'Parent note - start typing with a double left click!\n\nClick + to add children.\nDrag to move, resize from corner.',
      color: '#fef3c7',
      width: '500px',
      height: '350px',
      x: 20,
      y: 20,
      fontSize: 14,
      fontWeight: 400,
      markdown: true,
      children: [
        {
          id: '2',
          text: 'Note 1',
          // color: '#1b70dfa1',
          color: '#5eb5dd3f',
          width: '200px',
          height: '150px',
          x: 10,
          // y: 10,
          y: 120,
          fontSize: 14,
          fontWeight: 400,
          markdown: true,
          children: [],
        },
        {
          id: '3',
          text: 'Note 2',
          // color: '#cc649fbb',
          color: '#ffc8fc4f',
          width: '200px',
          height: '150px',
          x: 240,
          y: 120,
          fontSize: 14,
          fontWeight: 400,
          markdown: true,
          children: [],
        },
      ],
    },
  ]);

  const [openColorPickerNoteId, setOpenColorPickerNoteId] = useState<string | null>(null);
  type ContextMenuState = { visible: boolean; x: number; y: number; noteId: string | null };
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    noteId: null,
  });
  const [showJson, setShowJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastSnapshotRef = useRef<number>(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [snapshotList, setSnapshotList] = useState<number[]>([]);

  // --- IndexedDB helpers for robust persistence ---
  const idbHelpers = useRef<{ dbPromise: Promise<IDBDatabase> | null }>({ dbPromise: null });
  const getDB = (): Promise<IDBDatabase> => {
    if (!('indexedDB' in window)) return Promise.reject(new Error('No IDB'));
    if (!idbHelpers.current.dbPromise) {
      idbHelpers.current.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('nested-notes-db', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
          if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return idbHelpers.current.dbPromise;
  };

  const idbPut = async (store: 'kv' | 'snapshots', key: IDBValidKey, value: unknown) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).put(value, key);
    });
  };
  const idbGet = async (store: 'kv' | 'snapshots', key: IDBValidKey) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  const idbGetAllKeys = async (store: 'kv' | 'snapshots'): Promise<IDBValidKey[]> => {
    const db = await getDB();
    return new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]) || []);
      req.onerror = () => reject(req.error);
    });
  };
  const idbDelete = async (store: 'kv' | 'snapshots', key: IDBValidKey) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).delete(key);
    });
  };

  const saveLatestIDB = async (data: Note[]) => {
    try {
      await idbPut('kv', 'latest', { data, ts: Date.now() });
      setLastSavedAt(Date.now());
    } catch (_) {}
  };
  const loadLatestIDB = async (): Promise<Note[] | null> => {
    try {
      const res = (await idbGet('kv', 'latest')) as { data?: Note[] } | undefined;
      return res?.data ?? null;
    } catch (_) {
      return null;
    }
  };
  const saveSnapshotIDB = async (data: Note[]) => {
    try {
      const id = Date.now();
      await idbPut('snapshots', id, { id, data, ts: id });
      await refreshSnapshotList();
      return id;
    } catch (_) { return null; }
  };
  const refreshSnapshotList = async () => {
    try {
      const keys = await idbGetAllKeys('snapshots');
      const sorted = [...keys].map(Number).sort((a, b) => b - a);
      setSnapshotList(sorted.slice(0, 10));
    } catch (_) { setSnapshotList([]); }
  };
  const loadSnapshotIDB = async (id: number): Promise<Note[] | null> => {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readonly');
        const req = tx.objectStore('snapshots').get(id);
        req.onsuccess = () => {
          const result = req.result as { data?: Note[] } | undefined;
          resolve(result?.data ?? null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (_) { return null; }
  };
  const pruneSnapshotsIDB = async (max = 10) => {
    try {
      const keys = await idbGetAllKeys('snapshots');
      const sorted = [...keys].sort((a, b) => Number(b) - Number(a));
      const toDelete = sorted.slice(max);
      await Promise.all(toDelete.map((k) => idbDelete('snapshots', k)));
    } catch (_) {}
  };

  // Load from persistent storage on mount (IndexedDB first, then localStorage)
  useEffect(() => {
    (async () => {
      let loaded = null;
      try { loaded = await loadLatestIDB(); } catch (_) {}
      if (!loaded) {
        try {
          const raw = localStorage.getItem('nested-notes');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) loaded = parsed;
          }
        } catch (_) {}
      }
      if (loaded) setNotes(loaded);
      await refreshSnapshotList();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave to IndexedDB + localStorage; periodic rolling snapshots
  useEffect(() => {
    if (!notes) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try { await saveLatestIDB(notes); } catch (_) {}
      try { localStorage.setItem('nested-notes', JSON.stringify(notes)); } catch (_) {}
    }, 500);

    const now = Date.now();
    if (now - lastSnapshotRef.current > 60000) { // every 60s
      (async () => {
        await saveSnapshotIDB(notes);
        await pruneSnapshotsIDB(10);
        lastSnapshotRef.current = now;
      })();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [notes]);

  const handleSaveToBrowser = async () => {
    try {
      await saveLatestIDB(notes);
      await saveSnapshotIDB(notes);
      await pruneSnapshotsIDB(10);
      localStorage.setItem('nested-notes', JSON.stringify(notes));
    } catch (_) {}
  };

  const handleLoadFromBrowser = async () => {
    try {
      const latest = await loadLatestIDB();
      if (latest && Array.isArray(latest)) { setNotes(latest); return; }
      const raw = localStorage.getItem('nested-notes');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setNotes(parsed);
      }
    } catch (_) {}
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notes.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportJSON = (e: ReactChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed)) setNotes(parsed);
      } catch (_) {
        // ignore parse errors for now
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleHideContextMenu = useCallback(() => {
    setContextMenu((prev) => {
      if (!prev.visible) return prev;
      return { ...prev, visible: false, noteId: null };
    });
  }, []);

  const handleShowContextMenu = useCallback(
    (x: number, y: number, noteId: string | null) => {
    // Global guard: never open menu if any overlay/editing is open
    try {
      const anyColor = !!document.querySelector('.color-picker');
      const anyTextMenu = !!document.querySelector('.text-menu');
      const active = document.activeElement;
      const anyEditing = active instanceof HTMLTextAreaElement;
      if (anyColor || anyTextMenu || anyEditing) return;
    } catch (_) {}
    const menuWidth = 180;
    const menuHeight = 60;
    const margin = 8;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    const clampedX =
      typeof window !== 'undefined'
        ? Math.max(margin, Math.min(x, viewportWidth - menuWidth - margin))
        : x;
    const clampedY =
      typeof window !== 'undefined'
        ? Math.max(margin, Math.min(y, viewportHeight - menuHeight - margin))
        : y;
    setContextMenu({ visible: true, x: clampedX, y: clampedY, noteId });
  },
  []);

  useEffect(() => {
    const handleGlobalMouseDown = () => handleHideContextMenu();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleHideContextMenu();
      }
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    document.addEventListener('scroll', handleGlobalMouseDown, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown);
      document.removeEventListener('scroll', handleGlobalMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleHideContextMenu]);

  const handleBackgroundContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleHideContextMenu();
    let closedSomething = false;
    // Close color pickers
    if (openColorPickerNoteId !== null) {
      setOpenColorPickerNoteId(null);
      closedSomething = true;
    }
    // Close any text menus (broadcast)
    if (document.querySelector('.text-menu')) {
      document.dispatchEvent(new Event('closeTextMenus'));
      closedSomething = true;
    }
    // Blur active textarea to exit editing
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement) {
      active.blur();
      closedSomething = true;
    }
    // If we closed something, do not open the add menu
    if (closedSomething) return;
    // Otherwise show the background context menu to add a root note
    handleShowContextMenu(event.clientX, event.clientY, null);
  };

  const adjustToFitChildren = (note: Note): Note => {
    if (!note.children || note.children.length === 0) return note;
    let maxX = 0;
    let maxY = 0;
    note.children.forEach((child) => {
      const childRight = (child.x || 0) + (parseInt(child.width) || 200);
      const childBottom = (child.y || 0) + (parseInt(child.height) || 150);
      maxX = Math.max(maxX, childRight);
      maxY = Math.max(maxY, childBottom);
    });
    const currentWidth = parseInt(note.width) || 500;
    const currentHeight = parseInt(note.height) || 350;
    const requiredWidth = maxX + 20;
    const requiredHeight = maxY + 58;
    const nextWidth = Math.max(currentWidth, requiredWidth);
    const nextHeight = Math.max(currentHeight, requiredHeight);
    if (nextWidth !== currentWidth || nextHeight !== currentHeight) {
      return { ...note, width: `${nextWidth}px`, height: `${nextHeight}px` };
    }
    return note;
  };

  const findAndUpdate = (items: Note[], id: string, updatedNote: Note): Note[] => {
    let changed = false;
    const result = items.map((item: Note) => {
      if (item.id === id) {
        changed = true;
        return adjustToFitChildren(updatedNote);
      }
      if (item.children && item.children.length > 0) {
        const updatedChildren = findAndUpdate(item.children, id, updatedNote);
        const childrenChanged =
          updatedChildren.length !== item.children.length ||
          updatedChildren.some((child, idx) => child !== item.children![idx]);
        if (childrenChanged) {
          changed = true;
          return adjustToFitChildren({ ...item, children: updatedChildren });
        }
      }
      return item;
    });
    return changed ? result : items;
  };

  const findAndDelete = (items: Note[], id: string): Note[] => {
    return items.filter((item: Note) => {
      if (item.id === id) {
        return false;
      }
      if (item.children) {
        item.children = findAndDelete(item.children, id);
      }
      return true;
    });
  };

  const findAndAddChild = (items: Note[], parentId: string): Note[] => {
    let changed = false;
    const result = items.map((item: Note) => {
      if (item.id === parentId) {
        const newWidth = 200;
        const newHeight = 150;
        
        const children = item.children || [];
        let spawnY = 40;
        
        if (children.length > 0) {
          let maxBottom = 0;
          children.forEach(child => {
            const childBottom = (child.y || 0) + (parseInt(child.height) || 150);
            maxBottom = Math.max(maxBottom, childBottom);
          });
          spawnY = maxBottom + 10;
        }
        
        const newChild: Note = {
          id: Date.now().toString(),
          text: 'New note',
          color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') + '40',
          width: `${newWidth}px`,
          height: `${newHeight}px`,
          x: 10,
          y: spawnY,
          fontSize: 14,
          fontWeight: 400,
          markdown: true,
          children: [],
        };
        
        const allChildren = [...children, newChild];
        changed = true;
        return adjustToFitChildren({ ...item, children: allChildren });
      }
      if (item.children && item.children.length > 0) {
        const updatedChildren = findAndAddChild(item.children, parentId);
        const childrenChanged =
          updatedChildren.length !== item.children.length ||
          updatedChildren.some((child, idx) => child !== item.children![idx]);
        if (childrenChanged) {
          changed = true;
          return adjustToFitChildren({ ...item, children: updatedChildren });
        }
      }
      return item;
    });
    return changed ? result : items;
  };

  const handleUpdate = (id: string, updatedNote: Note) => {
    setNotes((prev) => findAndUpdate(prev, id, updatedNote));
  };

  const handleDelete = (id: string) => {
    handleHideContextMenu();
    setOpenColorPickerNoteId(null);
    setNotes((prev) => findAndDelete(prev, id));
  };

  const handleAddChild = (parentId: string) => {
    handleHideContextMenu();
    setOpenColorPickerNoteId(null);
    setNotes((prev) => findAndAddChild(prev, parentId));
  };

  const handleAddRoot = () => {
    handleHideContextMenu();
    setOpenColorPickerNoteId(null);
    const newNote: Note = {
      id: Date.now().toString(),
      text: 'New Note',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') + '40',
      width: '400px',
      height: '250px',
      x: 50,
      y: 50,
      fontSize: 14,
      fontWeight: 400,
      markdown: false,
      children: [],
    };
    setNotes((prev) => [...prev, newNote]);
  };

  return (
    <div className="min-h-screen bg-gray-100 overflow-auto">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Nested Notes</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowJson(!showJson)}
              className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              {showJson ? 'Hide' : 'Show'} JSON
            </button>
            <button
              onClick={handleSaveToBrowser}
              className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              title="Save to browser"
            >
              Save
            </button>
            <button
              onClick={handleLoadFromBrowser}
              className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              title="Load from browser"
            >
              Load
            </button>
            <button
              onClick={async () => {
                const latestId = snapshotList[0];
                if (!latestId) return;
                const data = await loadSnapshotIDB(latestId);
                if (Array.isArray(data)) setNotes(data);
              }}
              className="px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm"
              title="Restore last backup"
            >
              Restore
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              title="Export to JSON file"
            >
              Export
            </button>
            <button
              onClick={handleImportClick}
              className="px-3 py-1.5 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              title="Import from JSON file"
            >
              Import
            </button>
            <button
              onClick={handleAddRoot}
              className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> Add Note
            </button>
          </div>
        </div>
        {lastSavedAt && (
          <div className="text-xs text-gray-500 mb-2">
            Auto-saved {new Date(lastSavedAt).toLocaleTimeString()} • Backups: {snapshotList.length}
          </div>
        )}

        <input
          type="file"
          accept="application/json"
          ref={fileInputRef}
          onChange={handleImportJSON}
          className="hidden"
          aria-label="Import notes from JSON file"
        />

        {showJson && (
          <div className="mb-4 p-3 bg-gray-800 text-green-400 rounded max-h-60 overflow-auto">
            <pre className="text-xs">{JSON.stringify(notes, null, 2)}</pre>
          </div>
        )}

        <div className="relative"
             onContextMenu={handleBackgroundContextMenu}
             onContextMenuCapture={(event) => {
               // Global guard: if any overlay or editing is open, consume and close
               try {
                 const anyColor = !!document.querySelector('.color-picker') || openColorPickerNoteId !== null;
                 const anyTextMenu = !!document.querySelector('.text-menu');
                 const active = document.activeElement;
                 const anyEditing = active instanceof HTMLTextAreaElement;
                 if (anyColor || anyTextMenu || anyEditing) {
                   event.preventDefault();
                   event.stopPropagation();
                   handleHideContextMenu();
                   if (openColorPickerNoteId !== null) setOpenColorPickerNoteId(null);
                   if (anyTextMenu) document.dispatchEvent(new Event('closeTextMenus'));
                   if (active instanceof HTMLElement && anyEditing) active.blur();
                 }
               } catch (_) {}
             }}>
          {notes.map((note) => (
            <NoteSquare
              key={note.id}
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
              onShowContextMenu={handleShowContextMenu}
              onHideContextMenu={handleHideContextMenu}
              openColorPickerNoteId={openColorPickerNoteId}
              setOpenColorPickerNoteId={setOpenColorPickerNoteId}
            />
          ))}
        </div>
        {contextMenu.visible && (
          <div
            className="fixed z-50 min-w-[160px] rounded-md border border-gray-300 bg-white py-1 text-sm shadow-lg"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
              onClick={() => {
                if (contextMenu.noteId) {
                  handleAddChild(contextMenu.noteId);
                } else {
                  handleAddRoot();
                }
              }}
            >
              {contextMenu.noteId ? 'Add Child Note' : 'Add Note'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
