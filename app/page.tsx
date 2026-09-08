"use client";
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { encryptFile, decryptFile, createPuzzles, masterCacheClean } from '../utils/vaultLogic';
import localforage from 'localforage';
import { Shield, QrCode, History, Trash2, Settings, Download } from 'lucide-react';

export default function CipherVault() {
  const [activeTab, setActiveTab] = useState('send');
  
  // Send States
  const [fileData, setFileData] = useState<string>('');
  const [password, setPassword] = useState('');
  const [puzzles, setPuzzles] = useState<string[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState(0);

  // Scan & History States
  const [scannedSessions, setScannedSessions] = useState<any>({});
  const [unlockPassword, setUnlockPassword] = useState('');
  
  // Settings States
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Load History on Mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const history = await localforage.getItem('scan_history') || {};
    setScannedSessions(history);
  };

  // --- SEND LOGIC ---
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
       // Convert to Base64 (Data URL includes file type automatically)
       setFileData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEncryptAndChunk = () => {
    if(!fileData || !password) return alert("File & Password required!");
    const fileId = "FILE_" + Math.random().toString(36).substr(2, 9);
    const encrypted = encryptFile(fileData, password);
    const generatedPuzzles = createPuzzles(encrypted, fileId);
    setPuzzles(generatedPuzzles);
    setCurrentPuzzle(0);
  };

  // --- SCAN LOGIC (Continuous) ---
  useEffect(() => {
    if (activeTab === 'scan') {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
      scanner.render(async (decodedText) => {
        try {
          const parsed = JSON.parse(decodedText);
          if(parsed.id && parsed.part && parsed.total) {
             const history: any = await localforage.getItem('scan_history') || {};
             if(!history[parsed.id]) {
                 history[parsed.id] = { total: parsed.total, chunks: {} };
             }
             history[parsed.id].chunks[parsed.part] = parsed.data;
             await localforage.setItem('scan_history', history);
             setScannedSessions(history);
             // Note: It will continuously scan. User stops manually when chunks are full.
          }
        } catch(e) { console.log("Not a valid CipherVault code"); }
      }, (err) => { /* Ignore read errors during continuous scanning */ });

      return () => { scanner.clear().catch(e => console.error(e)); };
    }
  }, [activeTab]);

  const handleDecrypt = (fileId: string) => {
    const session = scannedSessions[fileId];
    if(Object.keys(session.chunks).length < session.total) return alert("All puzzles not scanned yet!");
    
    // Assemble the vault
    let assembledEncryptedVault = "";
    for(let i=1; i<=session.total; i++) {
        assembledEncryptedVault += session.chunks[i];
    }
    
    const decryptedDataUrl = decryptFile(assembledEncryptedVault, unlockPassword);
    if(!decryptedDataUrl) return alert("Wrong Password! Vault remains locked.");
    
    // Download File
    const a = document.createElement('a');
    a.href = decryptedDataUrl;
    a.download = `Decrypted_Vault_${fileId}`;
    a.click();
  };

  // --- MASTER CACHE CLEAN LOGIC ---
  const handleMasterClean = async () => {
    if (deleteConfirm !== 'DELETE') return alert("Type DELETE to confirm!");
    setIsDeleting(true);
    await masterCacheClean();
    alert("System completely wiped. Restarting...");
    window.location.reload();
  };

  return (
    <div className="max-w-md mx-auto min-h-screen border-x border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center text-green-400">
          <Shield className="mr-2" /> CipherVault
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        
        {/* SEND TAB */}
        {activeTab === 'send' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Create Vault (Encrypt)</h2>
            <input type="file" onChange={handleFileUpload} className="w-full p-2 bg-gray-800 rounded" />
            <input type="password" placeholder="Set Vault Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-2 bg-gray-800 rounded outline-none" />
            <button onClick={handleEncryptAndChunk} className="w-full p-3 bg-green-600 hover:bg-green-700 rounded font-bold">Encrypt & Generate Puzzles</button>
            
            {puzzles.length > 0 && (
              <div className="mt-6 flex flex-col items-center p-4 bg-gray-900 rounded-lg">
                <p className="mb-2 text-sm text-gray-400">Puzzle {currentPuzzle + 1} of {puzzles.length}</p>
                <div className="bg-white p-2 rounded">
                  <QRCodeSVG value={puzzles[currentPuzzle]} size={200} />
                </div>
                <div className="flex justify-between w-full mt-4">
                  <button onClick={() => setCurrentPuzzle(prev => Math.max(0, prev - 1))} className="px-4 py-2 bg-gray-700 rounded">Prev</button>
                  <button onClick={() => setCurrentPuzzle(prev => Math.min(puzzles.length - 1, prev + 1))} className="px-4 py-2 bg-gray-700 rounded">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCAN TAB */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Continuous Scanner</h2>
            <p className="text-sm text-gray-400">Keep scanning the puzzles. They will auto-save to history.</p>
            <div id="reader" className="w-full bg-black rounded-lg overflow-hidden border border-gray-700"></div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Local Vaults (History)</h2>
            {Object.keys(scannedSessions).length === 0 ? <p className="text-gray-500">No scanned puzzles yet.</p> : null}
            
            {Object.keys(scannedSessions).map(fileId => {
               const session = scannedSessions[fileId];
               const currentScanned = Object.keys(session.chunks).length;
               const isComplete = currentScanned === session.total;
               
               return (
                 <div key={fileId} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400">ID: {fileId}</p>
                    <p className="font-bold my-1 text-green-400">Puzzles: {currentScanned} / {session.total} Scanned</p>
                    
                    {isComplete ? (
                      <div className="mt-3 space-y-2">
                        <input type="password" placeholder="Enter Vault Password" onChange={(e)=>setUnlockPassword(e.target.value)} className="w-full p-2 bg-gray-900 rounded text-sm" />
                        <button onClick={() => handleDecrypt(fileId)} className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded flex justify-center items-center">
                          <Download className="w-4 h-4 mr-2"/> Decrypt & Download
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-yellow-500 mt-2">Scan remaining puzzles to unlock.</p>
                    )}
                 </div>
               )
            })}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-red-500 flex items-center"><Trash2 className="mr-2"/> Danger Zone</h2>
            <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg">
                <p className="text-sm text-gray-300 mb-4">Warning: This will permanently delete all saved puzzles, history, service workers, and app cache. The app will be completely reset.</p>
                <input 
                  type="text" 
                  placeholder="Type DELETE to confirm" 
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="w-full p-2 bg-gray-900 rounded outline-none border border-red-800 mb-3" 
                />
                <button 
                  onClick={handleMasterClean} 
                  disabled={isDeleting}
                  className="w-full p-3 bg-red-600 hover:bg-red-700 rounded font-bold disabled:opacity-50">
                  {isDeleting ? 'Wiping System...' : 'MASTER CACHE CLEAN'}
                </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex border-t border-gray-800 bg-gray-900 p-2">
        <button onClick={() => setActiveTab('send')} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'send' ? 'text-green-400' : 'text-gray-500'}`}><QrCode className="w-5 h-5"/> <span className="text-xs mt-1">Send</span></button>
        <button onClick={() => setActiveTab('scan')} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'scan' ? 'text-green-400' : 'text-gray-500'}`}><QrCode className="w-5 h-5"/> <span className="text-xs mt-1">Scan</span></button>
        <button onClick={() => { setActiveTab('history'); loadHistory(); }} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'history' ? 'text-green-400' : 'text-gray-500'}`}><History className="w-5 h-5"/> <span className="text-xs mt-1">History</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'settings' ? 'text-red-400' : 'text-gray-500'}`}><Settings className="w-5 h-5"/> <span className="text-xs mt-1">Clean</span></button>
      </div>
    </div>
  );
}
