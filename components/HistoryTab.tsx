"use client";
import React, { useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import { decryptFile } from '../utils/vaultLogic';
// 🚀 FIX: Added 'Layers' to the import list below!
import { Download, Eye, Trash2, Copy, CheckCircle, Share2, Grid3X3, X, AlertTriangle, Loader2, LockOpen, Zap, ShieldCheck, Layers } from 'lucide-react';

export default function HistoryTab({ isActive }: { isActive: boolean }) {
  const [vaultMeta, setVaultMeta] = useState<{ [key: string]: { total: number, current: number, isComplete: boolean } }>({});
  
  const [unlockPassword, setUnlockPassword] = useState('');
  const [previewData, setPreviewData] = useState<{type: string, data: string} | null>(null);
  
  const [matrixData, setMatrixData] = useState<{id: string, total: number, chunks: any} | null>(null);
  const [missingData, setMissingData] = useState<{ id: string, parts: number[] } | null>(null);
  
  const [undoItem, setUndoItem] = useState<{id: string, data: any, timeout: any} | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [decryptStatus, setDecryptStatus] = useState({ active: false, msg: '', percent: 0 });

  useEffect(() => {
      let interval: NodeJS.Timeout;
      if(isActive) {
          loadMetadata();
          interval = setInterval(loadMetadata, 1000);
      }
      return () => clearInterval(interval);
  }, [isActive]);

  const loadMetadata = async () => {
      const history: any = await localforage.getItem('scan_history') || {};
      const meta: any = {};
      for (const key in history) {
          const session = history[key];
          const currentCount = Object.keys(session.chunks).length;
          meta[key] = {
              total: session.total,
              current: currentCount,
              isComplete: currentCount === session.total
          };
      }
      setVaultMeta(meta);
  };

  const handleAction = async (fileId: string, action: 'view' | 'download') => {
      setDecryptStatus({ active: true, msg: 'Initializing Decryption Engine...', percent: 10 });
      await new Promise(r => setTimeout(r, 100)); 
      
      try {
          setDecryptStatus({ active: true, msg: 'Loading Fragments from Secure Vault...', percent: 30 });
          const history: any = await localforage.getItem('scan_history');
          const session = history[fileId];
          await new Promise(r => setTimeout(r, 50));
          
          setDecryptStatus({ active: true, msg: 'Assembling Code Blocks...', percent: 50 });
          const parts = [];
          for(let i=1; i<=session.total; i++) parts.push(session.chunks[i]);
          const assembled = parts.join('');
          await new Promise(r => setTimeout(r, 50));
          
          setDecryptStatus({ active: true, msg: 'Decrypting AES-256 & Decompressing ZLIB...', percent: 80 });
          await new Promise(r => setTimeout(r, 50)); 
          
          const decrypted = decryptFile(assembled, unlockPassword);
          if(!decrypted) {
              setDecryptStatus({ active: false, msg: '', percent: 0 });
              return alert("❌ Wrong Password! Vault remains locked.");
          }
          
          setDecryptStatus({ active: true, msg: 'Processing Output Files...', percent: 100 });
          await new Promise(r => setTimeout(r, 50));
          
          if(action === 'view') {
              if(decrypted.startsWith("TXT_MSG:")) setPreviewData({type: 'text', data: decrypted.replace("TXT_MSG:", "")});
              else {
                  try {
                      const parsed = JSON.parse(decrypted); 
                      if (parsed.data && parsed.data.length > 0) {
                          const firstItem = parsed.data[0];
                          if(firstItem.startsWith("data:image")) setPreviewData({type: 'image', data: firstItem});
                          else if(firstItem.startsWith("data:video")) setPreviewData({type: 'video', data: firstItem});
                          else if(firstItem.startsWith("data:audio")) setPreviewData({type: 'audio', data: firstItem});
                          else alert("Cannot preview this document type. Please download.");
                      }
                  } catch(e) {}
              }
          } else {
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
      } catch (err) { alert("An error occurred during decryption."); }
      
      setDecryptStatus({ active: false, msg: '', percent: 0 });
  };

  const openMatrix = async (fileId: string) => {
      const history: any = await localforage.getItem('scan_history');
      setMatrixData({ id: fileId, total: history[fileId].total, chunks: history[fileId].chunks });
  };

  const toggleMissingList = async (fileId: string, total: number) => {
      if (missingData?.id === fileId) {
          setMissingData(null); 
      } else {
          const history: any = await localforage.getItem('scan_history');
          const chunks = history[fileId].chunks;
          const missing = Array.from({length: total}, (_, i) => i+1).filter(i => !chunks[i]);
          setMissingData({ id: fileId, parts: missing });
      }
  };

  const copyToClipboard = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {} };
  const shareText = async (text: string) => { if (navigator.share) { try { await navigator.share({ title: 'CipherVault Message', text: text }); } catch(e) {} } else { copyToClipboard(text); alert("Sharing not supported. Copied!"); } };

  const handleDelete = async (fileId: string) => {
      if(!window.confirm("Are you sure you want to delete this vault?")) return;
      const history: any = await localforage.getItem('scan_history');
      const deletedData = history[fileId];
      delete history[fileId];
      await localforage.setItem('scan_history', history);
      loadMetadata(); 

      const timeout = setTimeout(() => { setUndoItem(null); }, 4000);
      setUndoItem({ id: fileId, data: deletedData, timeout });
  };

  const undoDelete = async () => {
      if(undoItem) {
          clearTimeout(undoItem.timeout);
          const history: any = await localforage.getItem('scan_history') || {};
          history[undoItem.id] = undoItem.data;
          await localforage.setItem('scan_history', history);
          setUndoItem(null);
          loadMetadata();
      }
  };

  return (
    <div className="space-y-5 animate-in fade-in pb-10">
      
      {decryptStatus.active && (
          <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center shadow-2xl transition-all">
              <div className="relative mb-10 flex justify-center items-center">
                  <div className="absolute inset-0 bg-green-500 blur-[70px] opacity-20 rounded-full w-32 h-32 m-auto animate-pulse"></div>
                  <div className="relative z-10 p-6 bg-gray-900 rounded-full shadow-2xl border border-gray-800 animate-[spin_3s_linear_infinite]">
                      <LockOpen className="w-12 h-12 text-green-500"/>
                  </div>
                  <ShieldCheck className="w-10 h-10 text-blue-500 absolute -bottom-3 -right-3 z-20 drop-shadow-lg"/>
              </div>

              <h2 className="text-2xl font-black text-white mb-4 tracking-widest">{decryptStatus.msg}</h2>
              
              <div className="w-full max-w-md bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800 shadow-inner relative mb-2">
                  <div className="bg-gradient-to-r from-blue-600 via-green-500 to-emerald-400 h-full transition-all duration-300" style={{ width: `${decryptStatus.percent}%` }}></div>
              </div>
              <p className="text-green-500 font-mono text-sm font-bold">{decryptStatus.percent}% Completed</p>
              
              <p className="text-gray-500 text-xs mt-8 flex items-center bg-gray-900 px-4 py-2 rounded-xl border border-gray-800"><Zap className="w-3 h-3 mr-2 text-yellow-500"/> Turbo Decryption Engine Active</p>
          </div>
      )}

      {/* 🚀 FIX: Layers icon is now successfully imported and won't crash */}
      <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 flex items-center"><Layers className="w-6 h-6 mr-2 text-blue-500"/> Real-time Vault Assembly</h2>
      
      {Object.keys(vaultMeta).length === 0 && <p className="text-center text-gray-500 mt-10 font-bold">No parts scanned yet.</p>}
      
      {matrixData && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
                  <button onClick={()=>setMatrixData(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-800 rounded-full p-2"><X className="w-5 h-5"/></button>
                  <div className="mb-6">
                      <h3 className="text-2xl font-black text-white flex items-center"><Grid3X3 className="w-6 h-6 mr-2 text-blue-500"/> Puzzle Matrix</h3>
                      <p className="text-gray-400 text-sm mt-1">Visualizing {matrixData.total} Security Fragments</p>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                      <div className="flex flex-wrap gap-1.5">
                          {Array.from({length: matrixData.total}, (_, i) => i + 1).map(num => {
                              const isFound = !!matrixData.chunks[num];
                              return <div key={num} title={`Fragment ${num}`} className={`w-3 h-3 md:w-4 md:h-4 rounded-[3px] transition-all duration-300 ${isFound ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500/20 border border-red-500/40 animate-pulse'}`}></div>
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

      {previewData && (
          <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
              <button onClick={()=>setPreviewData(null)} className="absolute top-6 right-6 text-white bg-gray-800 hover:bg-gray-700 p-3 rounded-full transition-all">Close</button>
              {previewData.type === 'text' && (
                  <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 rounded-3xl max-w-lg w-full border border-gray-200 dark:border-gray-800 shadow-2xl relative">
                      <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                          <h3 className="font-bold text-lg text-green-600">Decrypted Message</h3>
                          <div className="flex space-x-2">
                              <button onClick={() => shareText(previewData.data)} className="flex items-center text-xs font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 px-3 py-2 rounded-lg transition-all"><Share2 className="w-4 h-4 mr-1"/> Share</button>
                              <button onClick={() => copyToClipboard(previewData.data)} className="flex items-center text-xs font-bold bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 transition-all">
                                  {copied ? <><CheckCircle className="w-4 h-4 mr-1 text-green-500"/> Copied</> : <><Copy className="w-4 h-4 mr-1"/> Copy</>}
                              </button>
                          </div>
                      </div>
                      <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed max-h-[60vh] overflow-y-auto">{previewData.data}</p>
                  </div>
              )}
              {previewData.type === 'image' && <img src={previewData.data} className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />}
              {previewData.type === 'video' && <video src={previewData.data} controls className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" autoPlay />}
              {previewData.type === 'audio' && <audio src={previewData.data} controls className="w-full max-w-sm shadow-2xl" autoPlay />}
          </div>
      )}

      {undoItem && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full flex items-center shadow-2xl animate-in slide-in-from-top-5">
              <span>Vault deleted.</span>
              <button onClick={undoDelete} className="ml-4 text-green-400 font-bold underline">UNDO</button>
          </div>
      )}

      {Object.keys(vaultMeta).map(fileId => {
         const meta = vaultMeta[fileId];
         
         return (
           <div key={fileId} className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm relative transition-all">
              <button onClick={() => handleDelete(fileId)} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
              
              <div className="mb-3">
                  <p className="text-xs font-mono text-gray-500 tracking-wider font-bold">VAULT_ID: {fileId}</p>
                  <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${meta.isComplete ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border border-green-200 dark:border-green-800' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border border-orange-200 dark:border-orange-800 animate-pulse'}`}>
                      {meta.isComplete ? 'Decryption Ready' : 'Assembly In Progress...'}
                  </span>
              </div>
              
              <p className="font-black text-3xl mb-4 text-gray-900 dark:text-white flex items-baseline">
                  {meta.current} <span className="text-lg text-gray-500 font-medium ml-2">/ {meta.total} Parts</span>
              </p>
              
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-5 overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${meta.isComplete ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${(meta.current / meta.total) * 100}%` }}></div>
              </div>
              
              {meta.isComplete ? (
                <div className="flex space-x-2 bg-gray-50 dark:bg-gray-950 p-2 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <input type="password" placeholder="Enter Password" onChange={(e)=>setUnlockPassword(e.target.value)} className="flex-1 p-3 bg-transparent outline-none font-bold" />
                  <button onClick={() => handleAction(fileId, 'view')} className="px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm"><Eye className="w-5 h-5"/></button>
                  <button onClick={() => handleAction(fileId, 'download')} className="px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors shadow-sm"><Download className="w-5 h-5"/></button>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
                    <button onClick={() => openMatrix(fileId)} className="w-full flex items-center justify-center p-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-xl font-bold text-sm transition-colors mb-3">
                        <Grid3X3 className="w-4 h-4 mr-2 text-blue-500"/> View Live Puzzle Matrix
                    </button>
                    
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleMissingList(fileId, meta.total)}>
                        <p className="text-xs font-bold text-orange-500 flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Missing {meta.total - meta.current} Fragments</p>
                        <p className="text-xs text-blue-500 font-bold hover:underline">{missingData?.id === fileId ? 'Hide List' : 'Show List'}</p>
                    </div>
                    
                    {missingData?.id === fileId && (
                        <div className="mt-3 p-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl max-h-24 overflow-y-auto custom-scrollbar">
                            <p className="text-xs font-mono text-gray-500 leading-relaxed">{missingData.parts.join(', ')}</p>
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
