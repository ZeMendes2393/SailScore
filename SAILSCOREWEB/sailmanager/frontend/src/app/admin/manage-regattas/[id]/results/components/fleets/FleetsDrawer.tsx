'use client';

import { PropsWithChildren } from 'react';

export default function FleetsDrawer({
  open, onClose, children, title = 'Fleet Manager'
}: PropsWithChildren<{ open: boolean; onClose: () => void; title?: string }>) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-xl flex flex-col">
        <div className="p-4 border-b flex items-center gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="ml-auto px-3 py-1 rounded border hover:bg-gray-50" onClick={onClose}>Fechar</button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
