"use client";
import React, { useState, useEffect } from 'react';
import localforage from 'localforage';
import { decryptFile } from '../utils/vaultLogic';
import { Download, Eye, Trash2, Copy, CheckCircle, Share2, Grid3X3, X, AlertTriangle } from 'lucide-react';

export default function HistoryTab({ isActive }: { isActive: boolean }) {
  const [scannedSessions, setScannedSessions] = useState<any>({});
  const [unlockPassword, setUnlockPassword] = useState('');
  const [previewData, setPreviewData] = useState<{type: string, data: string} | null>(null);
  const [matrixData, setMatrixData] = useState<{id: string, total: number, chunks: any} | null>(null);
  const [isMissingFolded, setIsMissingFolded] = useState<{ [key: string]: boolean }>({});

  useEffect(() => { if(isActive) loadHistory(); }, [isActive]);
  const loadHistory = async () => { setScannedSessions(await localforage.getItem('scan_history') || {}); };

  const handleAction = (fileId: string, action: 'view' | 'download') => {
      // (Omitted for brevity - EXACT SAME AS BEFORE)
      const session = scannedSessions[fileId];
      let assembled = ""; for(let i=1; i<=session.total; i++) assembled += session.chunks[i];
      const decrypted = decryptFile(assembled, unlockPassword);
      if(!decrypted) return alert("❌ Wrong Password!");
      
      if(action === 'view') {
          if(decrypted.startsWith("TXT_MSG:")) setPreviewData({type: 'text', data: decrypted.replace("TXT_MSG:", "")});
          else {
              try {
                  const parsed = JSON.parse(decrypted); 
                  if (parsed.data && parsed.data.length > 0) {
                      const firstItem = parsed.data[0];
                      if(firstItem.startsWith("data:image")) setPreviewData({type: 'image', data: firstItem});
                      else if(firstItem.startsWith("data:video")) setPreviewData({type: 'video', data: firstItem});
                      else alert("Cannot preview this document type. Please download.");
                  }
              } catch(e) {}
          }
      } else {
          // Download...
          if(decrypted.startsWith("TXT_MSG:")) {
              const text = decrypted.replace("TXT_MSG:", "");
              const a = document.createElement('a'); a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(text); a.download = `SecretMsg_${fileId}.txt`; a.click();
          } else {
              try {
                  const parsed = JSON.parse(decrypted);
                  if (parsed.data) {
                      parsed.data.forEach((dataUrl: string, idx: number) => {
                          const ext = dataUrl.split(';')[0].split('/')[1] || 'bin';
                          const a = document.createElement('a'); a.href = dataUrl; a.download = parsed.isMulti ? `Vault_${fileId}_File${idx + 1}.${ext}` : `Vault_${fileId}.${ext}`; a.click();
                      });
                  }
              } catch(e) { }
          }
      }
  };

  const handleDelete = async (fileId: string) => {
      if(!window.confirm("Are you sure?")) return;
      const newSessions = {...scannedSessions}; delete newSessions[fileId];
      setScannedSessions(newSessions); await localforage.setItem('scan_history', newSessions);
  };

  const toggleFold = (id: string) => setIsMissingFolded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-5 animate-in fade-in pb-10">
      <h2 className="text-xl font-bold">Vault Assembly (History)</h2>
      {Object.keys(scannedSessions).length === 0 && <p className="text-center text-gray-500 mt-10">No parts scanned yet.</p>}
      
      {/* 🚀 BEAUTIFUL PUZZLE MATRIX MODAL */}
      {matrixData && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
                  <button onClick={()=>setMatrixData(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-800 rounded-full p-2"><X className="w-5 h-5"/></button>
                  <div className="mb-6">
                      <h3 className="text-2xl font-black text-white flex items-center"><Grid3X3 className="w-6 h-6 mr-2 text-blue-500"/> Puzzle Matrix</h3>
                      <p className="text-gray-400 text-sm mt-1">Visualizing {matrixData.total} Security Fragments</p>
                  </div>
                  
                  <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="flex flex-wrap gap-1">
                          {Array.from({length: matrixData.total}, (_, i) => i + 1).map(num => {
                              const isFound = !!matrixData.chunks[num];
                              return (
                                  <div key={num} title={`Fragment ${num}`} className={`w-3 h-3 md:w-4 md:h-4 rounded-[2px] transition-all duration-300 ${isFound ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500/20 border border-red-500/50 animate-pulse'}`}></div>
                              )
                          })}
                      </div>
                  </div>
                  <div className="mt-6 flex justify-between items-center text-xs font-bold bg-gray-800 p-3 rounded-xl border border-gray-700">
                      <div className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded-sm mr-2 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div> <span className="text-white">Recovered ({Object.keys(matrixData.chunks).length})</span></div>
                      <div className="flex items-center"><div className="w-3 h-3 bg-red-500/20 border border-red-500/50 rounded-sm mr-2"></div> <span className="text-gray-400">Missing ({matrixData.total - Object.keys(matrixData.chunks).length})</span></div>
                  </div>
              </div>
          </div>
      )}

      {/* Preview Modal... (Same as before) */}
      {previewData && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
              <button onClick={()=>setPreviewData(null)} className="absolute top-6 right-6 text-white bg-gray-800 hover:bg-gray-700 p-3 rounded-full transition-all">Close</button>
              {previewData.type === 'text' && (
                  <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 rounded-3xl max-w-lg w-full border border-gray-200 dark:border-gray-800 shadow-2xl relative">
                      <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed max-h-[60vh] overflow-y-auto">{previewData.data}</p>
                  </div>
              )}
              {previewData.type === 'image' && <img src={previewData.data} className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />}
              {previewData.type === 'video' && <video src={previewData.data} controls className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" autoPlay />}
          </div>
      )}

      {Object.keys(scannedSessions).map(fileId => {
         const session = scannedSessions[fileId];
         const currentScanned = Object.keys(session.chunks).length;
         const isComplete = currentScanned === session.total;
         const missingParts = Array.from({length: session.total}, (_, i) => i+1).filter(i => !session.chunks[i]);
         
         return (
           <div key={fileId} className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm relative transition-all">
              <button onClick={() => handleDelete(fileId)} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
              <div className="mb-3">
                  <p className="text-xs font-mono text-gray-500 tracking-wider">VAULT_ID: {fileId}</p>
                  <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${isComplete ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border border-orange-200 dark:border-orange-800'}`}>
                      {isComplete ? 'Decryption Ready' : 'Assembly Incomplete'}
                  </span>
              </div>
              <p className="font-black text-2xl mb-4">{currentScanned} <span className="text-lg text-gray-500 font-medium">/ {session.total} Parts</span></p>
              
              {isComplete ? (
                <div className="flex space-x-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <input type="password" placeholder="Enter Password" onChange={(e)=>setUnlockPassword(e.target.value)} className="flex-1 p-3 bg-transparent outline-none font-bold" />
                  <button onClick={() => handleAction(fileId, 'view')} className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm"><Eye className="w-5 h-5"/></button>
                  <button onClick={() => handleAction(fileId, 'download')} className="px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm"><Download className="w-5 h-5"/></button>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
                    <button onClick={() => setMatrixData({id: fileId, total: session.total, chunks: session.chunks})} className="w-full flex items-center justify-center p-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-xl font-bold text-sm transition-colors mb-3">
                        <Grid3X3 className="w-4 h-4 mr-2"/> View Puzzle Matrix
                    </button>
                    
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleFold(fileId)}>
                        <p className="text-xs font-bold text-orange-500 flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Missing {missingParts.length} Fragments</p>
                        <p className="text-xs text-blue-500 font-bold hover:underline">{isMissingFolded[fileId] ? 'Show List' : 'Hide List'}</p>
                    </div>
                    
                    {!isMissingFolded[fileId] && (
                        <div className="mt-3 p-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl max-h-24 overflow-y-auto custom-scrollbar">
                            <p className="text-xs font-mono text-gray-500 leading-relaxed">{missingParts.join(', ')}</p>
                        </div>
                    )}
                </div>
              )}
           </div>
         )
      })}
    </div>
  );
}
