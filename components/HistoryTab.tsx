"use client";
import React, { useState, useEffect } from 'react';
import localforage from 'localforage';
import { decryptFile } from '../utils/vaultLogic';
import { Download, Eye, Trash2 } from 'lucide-react';

export default function HistoryTab({ isActive }: { isActive: boolean }) {
  const [scannedSessions, setScannedSessions] = useState<any>({});
  const [unlockPassword, setUnlockPassword] = useState('');
  const [previewData, setPreviewData] = useState<{type: string, data: string} | null>(null);
  const [undoItem, setUndoItem] = useState<{id: string, data: any, timeout: any} | null>(null);

  useEffect(() => { if(isActive) loadHistory(); }, [isActive]);
  const loadHistory = async () => { setScannedSessions(await localforage.getItem('scan_history') || {}); };

  const handleAction = (fileId: string, action: 'view' | 'download') => {
    const session = scannedSessions[fileId];
    if(Object.keys(session.chunks).length < session.total) return alert("Puzzles incomplete!");
    let assembled = "";
    for(let i=1; i<=session.total; i++) assembled += session.chunks[i];
    const decrypted = decryptFile(assembled, unlockPassword);
    if(!decrypted) return alert("❌ Wrong Password!");
    
    if(action === 'view') {
        if(decrypted.startsWith("TXT_MSG:")) setPreviewData({type: 'text', data: decrypted.replace("TXT_MSG:", "")});
        else if(decrypted.startsWith("data:image")) setPreviewData({type: 'image', data: decrypted});
        else if(decrypted.startsWith("data:video")) setPreviewData({type: 'video', data: decrypted});
        else alert("Cannot preview this file type. Please download.");
    } else {
        const ext = decrypted.split(';')[0].split('/')[1] || 'bin';
        const fileName = window.prompt("Enter file name for download:", `Decrypted_${fileId}`);
        if(fileName) {
            const finalName = fileName.includes('.') ? fileName : `${fileName}.${ext}`;
            const a = document.createElement('a'); a.href = decrypted.replace("TXT_MSG:", "data:text/plain;charset=utf-8,"); 
            a.download = finalName; a.click();
        }
    }
  };

  const handleDelete = (fileId: string) => {
      if(!window.confirm("Are you sure you want to delete this vault from history?")) return;
      const newSessions = {...scannedSessions};
      const deletedData = newSessions[fileId];
      delete newSessions[fileId];
      setScannedSessions(newSessions);

      const timeout = setTimeout(async () => {
          await localforage.setItem('scan_history', newSessions);
          setUndoItem(null);
      }, 3000);

      setUndoItem({ id: fileId, data: deletedData, timeout });
  };

  const undoDelete = () => {
      if(undoItem) {
          clearTimeout(undoItem.timeout);
          const restored = {...scannedSessions, [undoItem.id]: undoItem.data};
          setScannedSessions(restored);
          setUndoItem(null);
      }
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-10">
      <h2 className="text-xl font-bold">Vault Assembly (History)</h2>
      {Object.keys(scannedSessions).length === 0 && <p className="text-center text-gray-500 mt-10">No parts scanned yet.</p>}
      
      {/* Preview Modal */}
      {previewData && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
              <button onClick={()=>setPreviewData(null)} className="absolute top-5 right-5 text-white bg-red-600 p-2 rounded-full">Close</button>
              {previewData.type === 'text' && <div className="bg-white text-black p-6 rounded-xl max-w-md w-full"><p>{previewData.data}</p></div>}
              {previewData.type === 'image' && <img src={previewData.data} className="max-w-full max-h-[80vh] rounded-xl" />}
              {previewData.type === 'video' && <video src={previewData.data} controls className="max-w-full max-h-[80vh] rounded-xl" autoPlay />}
          </div>
      )}

      {/* Undo Toast */}
      {undoItem && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full flex items-center shadow-2xl animate-in slide-in-from-top-5">
              <span>Vault deleted.</span>
              <button onClick={undoDelete} className="ml-4 text-green-400 font-bold underline">UNDO</button>
          </div>
      )}

      {Object.keys(scannedSessions).map(fileId => {
         const session = scannedSessions[fileId];
         const currentScanned = Object.keys(session.chunks).length;
         const isComplete = currentScanned === session.total;
         
         return (
           <div key={fileId} className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm relative">
              <button onClick={() => handleDelete(fileId)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
              <div className="mb-2">
                  <p className="text-xs font-mono text-gray-500">ID: {fileId}</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${isComplete ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400'}`}>
                      {isComplete ? 'Ready' : 'Incomplete'}
                  </span>
              </div>
              <p className="font-bold text-lg mb-3">{currentScanned} / {session.total} Parts</p>
              
              {isComplete ? (
                <div className="flex space-x-2">
                  <input type="password" placeholder="Password" onChange={(e)=>setUnlockPassword(e.target.value)} className="flex-1 p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-300 dark:border-gray-700 outline-none" />
                  <button onClick={() => handleAction(fileId, 'view')} className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"><Eye className="w-5 h-5"/></button>
                  <button onClick={() => handleAction(fileId, 'download')} className="px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl"><Download className="w-5 h-5"/></button>
                </div>
              ) : (
                <p className="text-xs text-orange-500">Missing parts: {Array.from({length: session.total}, (_, i) => i+1).filter(i => !session.chunks[i]).join(', ')}</p>
              )}
           </div>
         )
      })}
    </div>
  );
}
