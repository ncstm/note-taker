// @ts-nocheck
// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <div>
//         <a href="https://vite.dev" target="_blank">
//           <img src={viteLogo} className="logo" alt="Vite logo" />
//         </a>
//         <a href="https://react.dev" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <h1>Vite + React</h1>
//       <div className="card">
//         <button onClick={() => setCount((count) => count + 1)}>
//           count is {count}
//         </button>
//         <p>
//           Edit <code>src/App.tsx</code> and save to test HMR
//         </p>
//       </div>
//       <p className="read-the-docs">
//         Click on the Vite and React logos to learn more
//       </p>
//     </>
//   )
// }

// export default App
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Palette } from 'lucide-react';

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

const NoteSquare = ({
  note,
  onUpdate,
  onDelete,
  onAddChild,
  onShowContextMenu,
  onHideContextMenu,
  openColorPickerNoteId,
  setOpenColorPickerNoteId,
  depth = 0,
  allNotes = [],
  parentWidth,
  parentHeight,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, noteX: 0, noteY: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const usedColors = PRESET_COLORS;
  const showColorPicker = openColorPickerNoteId === note.id;
  const textareaRef = useRef(null);
  const noteRef = useRef(null);

  const checkOverlap = (x, y, width, height, excludeId) => {
    const siblings = allNotes.filter(n => n.id !== excludeId);
    for (let sibling of siblings) {
      const sibWidth = parseInt(sibling.width) || 280;
      const sibHeight = parseInt(sibling.height) || 180;
      const sibX = sibling.x || 0;
      const sibY = sibling.y || 0;
      
      if (!(x + width <= sibX || x >= sibX + sibWidth || 
            y + height <= sibY || y >= sibY + sibHeight)) {
        return true;
      }
    }
    return false;
  };

  const handleDragStart = (e) => {
    // Do not start dragging when interacting with UI controls or while editing text
    if (
      e.target.tagName === 'BUTTON' ||
      e.target.closest('.color-picker') ||
      e.target.closest('.resize-handle') ||
      isEditing ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.closest('.note-content')
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onHideContextMenu?.();
    setOpenColorPickerNoteId(null);
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      noteX: note.x || 0,
      noteY: note.y || 0
    });
  };

  const handleDoubleClick = (e) => {
    if (e.target.tagName === 'BUTTON' || 
        e.target.closest('.color-picker') ||
        e.target.closest('.resize-handle')) {
      return;
    }
    if (isEditing) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    onHideContextMenu?.();
    setOpenColorPickerNoteId(null);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    let newX = Math.max(0, dragStart.noteX + deltaX);
    let newY = Math.max(0, dragStart.noteY + deltaY);
    
    onUpdate(note.id, { ...note, x: newX, y: newY });
  };

  const handleResizeStart = (e) => {
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

  const handleResizeMove = (e) => {
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
      const handleMove = (e) => handleDragMove(e);
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
      const handleMove = (e) => handleResizeMove(e);
      const handleUp = () => setIsResizing(false);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isResizing, resizeStart]);

  const handleColorChange = (color) => {
    onUpdate(note.id, { ...note, color });
    // Keep palette positions stable and close after selection
    setOpenColorPickerNoteId(null);
  };

  const handleTextChange = (e) => {
    onUpdate(note.id, { ...note, text: e.target.value });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onHideContextMenu?.();
    const wasColorPickerOpen = showColorPicker;
    setOpenColorPickerNoteId(null);
    if (isEditing) {
      setIsEditing(false);
      return;
    }
    if (wasColorPickerOpen) {
      return;
    }
    onShowContextMenu?.(e.clientX, e.clientY, note.id);
  };

  return (
    <div
      ref={noteRef}
      className="border-2 rounded absolute select-none"
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
        <div className="flex gap-1">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHideContextMenu?.();
                setOpenColorPickerNoteId(showColorPicker ? null : note.id);
              }}
              className="p-1 hover:bg-black/10 rounded cursor-pointer"
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHideContextMenu?.();
              setOpenColorPickerNoteId(null);
              onAddChild(note.id);
            }}
            className="p-1 hover:bg-black/10 rounded cursor-pointer"
            title="Add child"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHideContextMenu?.();
              setOpenColorPickerNoteId(null);
              onDelete(note.id);
            }}
            className="p-1 hover:bg-black/10 rounded cursor-pointer"
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
            className="w-full h-full p-1 text-sm resize-none border-none outline-none"
            placeholder="Type here..."
            style={{ 
              backgroundColor: 'transparent',
              color: 'inherit',
            }}
          />
        ) : (
          <div className="w-full h-full p-1 text-sm whitespace-pre-wrap">
            {note.text || 'Double-click to edit'}
          </div>
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
                  allNotes={note.children}
                  parentWidth={parseInt(note.width) || 280}
                  parentHeight={(parseInt(note.height) || 180) - 38}
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
        <div className="w-4 h-4 border-r-2 border-b-2 border-gray-600 mb-0.5 mr-0.5" />
      </div>
    </div>
  );
};

export default function App() {
  const [notes, setNotes] = useState([
    {
      id: '1',
      text: 'Parent note - just start typing!\n\nClick + to add children.\nDrag to move, resize from corner.',
      color: '#fef3c7',
      width: '500px',
      height: '350px',
      x: 20,
      y: 20,
      children: [
        {
          id: '2',
          text: 'Child 1',
          color: '#dbeafe',
          width: '200px',
          height: '150px',
          x: 10,
          y: 10,
          children: [],
        },
        {
          id: '3',
          text: 'Child 2',
          color: '#fce7f3',
          width: '200px',
          height: '150px',
          x: 220,
          y: 10,
          children: [],
        },
      ],
    },
  ]);

  const [openColorPickerNoteId, setOpenColorPickerNoteId] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, noteId: null });
  const [showJson, setShowJson] = useState(false);
  const fileInputRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastSnapshotRef = useRef(0);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [snapshotList, setSnapshotList] = useState([]);

  // --- IndexedDB helpers for robust persistence ---
  const idbHelpers = useRef({ dbPromise: null });
  const getDB = () => {
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

  const idbPut = async (store, key, value) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).put(value, key);
    });
  };
  const idbGet = async (store, key) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };
  const idbGetAllKeys = async (store) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  };
  const idbDelete = async (store, key) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(store).delete(key);
    });
  };

  const saveLatestIDB = async (data) => {
    try {
      await idbPut('kv', 'latest', { data, ts: Date.now() });
      setLastSavedAt(Date.now());
    } catch (_) {}
  };
  const loadLatestIDB = async () => {
    try {
      const res = await idbGet('kv', 'latest');
      return res?.data;
    } catch (_) {
      return null;
    }
  };
  const saveSnapshotIDB = async (data) => {
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
      const sorted = [...keys].sort((a, b) => Number(b) - Number(a));
      setSnapshotList(sorted.slice(0, 10).map((k) => Number(k)));
    } catch (_) { setSnapshotList([]); }
  };
  const loadSnapshotIDB = async (id) => {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readonly');
        const req = tx.objectStore('snapshots').get(id);
        req.onsuccess = () => resolve(req.result?.data || null);
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
    return () => clearTimeout(saveTimeoutRef.current);
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
  const handleImportJSON = (e) => {
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

  const handleShowContextMenu = useCallback((x, y, noteId) => {
    const menuWidth = 180;
    const menuHeight = 60;
    const margin = 8;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    const clampedX = typeof window !== 'undefined'
      ? Math.max(margin, Math.min(x, viewportWidth - menuWidth - margin))
      : x;
    const clampedY = typeof window !== 'undefined'
      ? Math.max(margin, Math.min(y, viewportHeight - menuHeight - margin))
      : y;
    setContextMenu({ visible: true, x: clampedX, y: clampedY, noteId });
  }, []);

  useEffect(() => {
    const handleGlobalMouseDown = () => handleHideContextMenu();
    const handleKeyDown = (event) => {
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

  const handleBackgroundContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleHideContextMenu();
    setOpenColorPickerNoteId(null);
    handleShowContextMenu(event.clientX, event.clientY, null);
  };

  const findAndUpdate = (items, id, updatedNote) => {
    return items.map((item) => {
      if (item.id === id) {
        return updatedNote;
      }
      if (item.children) {
        const updatedChildren = findAndUpdate(item.children, id, updatedNote);
        
        let maxX = 0;
        let maxY = 0;
        updatedChildren.forEach(child => {
          const childRight = (child.x || 0) + (parseInt(child.width) || 200);
          const childBottom = (child.y || 0) + (parseInt(child.height) || 150);
          maxX = Math.max(maxX, childRight);
          maxY = Math.max(maxY, childBottom);
        });
        
        const currentWidth = parseInt(item.width) || 500;
        const currentHeight = parseInt(item.height) || 350;
        const requiredWidth = maxX + 20;
        const requiredHeight = maxY + 58;
        
        if (requiredWidth > currentWidth || requiredHeight > currentHeight) {
          return {
            ...item,
            width: `${Math.max(currentWidth, requiredWidth)}px`,
            height: `${Math.max(currentHeight, requiredHeight)}px`,
            children: updatedChildren
          };
        }
        
        return { ...item, children: updatedChildren };
      }
      return item;
    });
  };

  const findAndDelete = (items, id) => {
    return items.filter((item) => {
      if (item.id === id) {
        return false;
      }
      if (item.children) {
        item.children = findAndDelete(item.children, id);
      }
      return true;
    });
  };

  const findAvailablePosition = (parent, newWidth, newHeight) => {
    const children = parent.children || [];
    
    if (children.length === 0) {
      return { x: 10, y: 10 };
    }
    
    let maxX = 0;
    let maxY = 0;
    
    children.forEach(child => {
      const childRight = (child.x || 0) + (parseInt(child.width) || 200);
      const childBottom = (child.y || 0) + (parseInt(child.height) || 150);
      maxX = Math.max(maxX, childRight);
      maxY = Math.max(maxY, childBottom);
    });
    
    return { x: 10, y: maxY + 10 };
  };

  const findAndAddChild = (items, parentId) => {
    return items.map((item) => {
      if (item.id === parentId) {
        const newWidth = 200;
        const newHeight = 150;
        
        const children = item.children || [];
        let spawnY = 10;
        
        if (children.length > 0) {
          let maxBottom = 0;
          children.forEach(child => {
            const childBottom = (child.y || 0) + (parseInt(child.height) || 150);
            maxBottom = Math.max(maxBottom, childBottom);
          });
          spawnY = maxBottom + 10;
        }
        
        const newChild = {
          id: Date.now().toString(),
          text: 'New note',
          color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') + '40',
          width: `${newWidth}px`,
          height: `${newHeight}px`,
          x: 10,
          y: spawnY,
          children: [],
        };
        
        const allChildren = [...children, newChild];
        
        let maxX = 0;
        let maxY = 0;
        allChildren.forEach(child => {
          const childRight = (child.x || 0) + (parseInt(child.width) || 200);
          const childBottom = (child.y || 0) + (parseInt(child.height) || 150);
          maxX = Math.max(maxX, childRight);
          maxY = Math.max(maxY, childBottom);
        });
        
        const currentWidth = parseInt(item.width) || 500;
        const currentHeight = parseInt(item.height) || 350;
        const requiredWidth = maxX + 20;
        const requiredHeight = maxY + 58;
        
        return {
          ...item,
          width: `${Math.max(currentWidth, requiredWidth)}px`,
          height: `${Math.max(currentHeight, requiredHeight)}px`,
          children: allChildren,
        };
      }
      if (item.children) {
        return { ...item, children: findAndAddChild(item.children, parentId) };
      }
      return item;
    });
  };

  const handleUpdate = (id, updatedNote) => {
    setNotes((prev) => findAndUpdate(prev, id, updatedNote));
  };

  const handleDelete = (id) => {
    handleHideContextMenu();
    setOpenColorPickerNoteId(null);
    setNotes((prev) => findAndDelete(prev, id));
  };

  const handleAddChild = (parentId) => {
    handleHideContextMenu();
    setOpenColorPickerNoteId(null);
    setNotes((prev) => findAndAddChild(prev, parentId));
  };

  const handleAddRoot = () => {
    handleHideContextMenu();
    setOpenColorPickerNoteId(null);
    const newNote = {
      id: Date.now().toString(),
      text: 'New Note',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') + '40',
      width: '400px',
      height: '250px',
      x: 50,
      y: 50,
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
        />

        {showJson && (
          <div className="mb-4 p-3 bg-gray-800 text-green-400 rounded max-h-60 overflow-auto">
            <pre className="text-xs">{JSON.stringify(notes, null, 2)}</pre>
          </div>
        )}

        <div className="relative min-h-screen"
             onContextMenu={handleBackgroundContextMenu}>
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
              allNotes={notes}
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
