"use client";
import { Notice } from "@/types/notice";

interface Props {
  open: boolean;
  notice: Notice | null;
  onClose: () => void;
}

export default function PdfModal({ open, notice, onClose }: Props) {
  if (!open || !notice) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] max-w-5xl">
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-medium">{notice.title}</div>
          <button onClick={onClose} className="text-gray-600 hover:text-black">Fechar</button>
        </div>
        <div className="h-[calc(90vh-48px)]">
          <object data={notice.filepath} type="application/pdf" className="w-full h-full">
            <p className="p-4">Não foi possível pré-visualizar. <a className="text-blue-600 underline" href={notice.filepath} target="_blank">Abrir no navegador</a>.</p>
          </object>
        </div>
      </div>
    </div>
  );
}
