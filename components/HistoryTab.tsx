"use client";
import React, { useState, useEffect } from 'react';
import localforage from 'localforage';
import { decryptFile } from '../utils/vaultLogic';
import { Download } from 'lucide-react';

export default function HistoryTab({ isActive }: { isActive: boolean }) {
  const [scannedSessions, setScannedSessions] = useState<any>({});
  const [unlockPassword, setUnlockPassword] = useState('');

  useEffect(() => { if(isActive) loadHistory(); }, [isActive]);

  const loadHistory = async () => { setScannedSessions(await localforage.getItem('scan_history') || {}); };

  const handleDecrypt = (fileId: string) => {
    const session = scannedSessions[fileId];
    if(Object.keys(session.chunks).length < session.total) return alert("Puzzles incomplete!");
    let assembled = "";
    for(let i=1; i<=session.total; i++) assembled += session.chunks[i];
    const decrypted = decryptFile(assembled, unlockPassword);
    if(!decrypted) return alert("❌ Wrong Password!");
    if(decrypted.startsWith("TXT_MSG:")) {
        alert("Encrypted Text: \n\n" + decrypted.replace("TXT_MSG:", ""));
    } else {
        const a = document.createElement('a'); a.href = decrypted; a.download = `Decrypted_${fileId}`; a.click();
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      <h2 className="text-xl font-bold">Vault Assembly (History)</h2>
      {Object.keys(scannedSessions).length === 0 && <p className="text-center text-gray-500 mt-10">No parts scanned yet.</p>}
      
      {Object.keys(scannedSessions).map(fileId => {
         const session = scannedSessions[fileId];
         const currentScanned = Object.keys(session.chunks).length;
         const isComplete = currentScanned === session.total;
         
         return (
           <div key={fileId} className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-mono text-gray-500">{fileId}</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${isComplete ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400'}`}>
                      {isComplete ? 'Ready' : 'Incomplete'}
                  </span>
              </div>
              <p className="font-bold text-lg mb-3">{currentScanned} / {session.total} Parts</p>
              
              {isComplete ? (
                <div className="flex space-x-2">
                  <input type="password" placeholder="Password" onChange={(e)=>setUnlockPassword(e.target.value)} className="flex-1 p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-300 dark:border-gray-700 outline-none" />
                  <button onClick={() => handleDecrypt(fileId)} className="px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl"><Download className="w-5 h-5"/></button>
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
