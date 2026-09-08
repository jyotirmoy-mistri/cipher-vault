"use client";
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { encryptFile, decryptFile, createPuzzles, masterCacheClean } from '../utils/vaultLogic';
import localforage from 'localforage';
import { Shield, QrCode, History, Trash2, Settings, Download, Printer, AlertTriangle } from 'lucide-react';

export default function CipherVault() {
  const [activeTab, setActiveTab] = useState('send');
  
  // Send States
  const [fileData, setFileData] = useState<string>('');
  const [password, setPassword] = useState('');
  const [puzzles, setPuzzles] = useState<string[]>([]);

  // Scan & History States
  const [scannedSessions, setScannedSessions] = useState<any>({});
  const [unlockPassword, setUnlockPassword] = useState('');
  const [scanWarning, setScanWarning] = useState('');
  
  // Settings States
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const history = await localforage.getItem('scan_history') || {};
    setScannedSessions(history);
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setFileData(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEncryptAndChunk = () => {
    if(!fileData || !password) return alert("File & Password required!");
    const fileId = "FILE_" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const encrypted = encryptFile(fileData, password);
    const generatedPuzzles = createPuzzles(encrypted, fileId);
    setPuzzles(generatedPuzzles);
  };

  useEffect(() => {
    if (activeTab === 'scan') {
      const scanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: {width: 250, height: 250} }, false);
      scanner.render(async (decodedText) => {
        try {
          const parsed = JSON.parse(decodedText);
          // DIGITAL SIGNATURE CHECK
          if(parsed.cv_sig === "CipherVault_v1" && parsed.id && parsed.part && parsed.total) {
             setScanWarning(''); // Clear warning if valid
             const history: any = await localforage.getItem('scan_history') || {};
             if(!history[parsed.id]) history[parsed.id] = { total: parsed.total, chunks: {} };
             
             history[parsed.id].chunks[parsed.part] = parsed.data;
             await localforage.setItem('scan_history', history);
             setScannedSessions(history);
          } else {
             showWarning("⚠️ Invalid Code: Not a CipherVault File!");
          }
        } catch(e) { 
           showWarning("⚠️ Unknown QR Format Detected!"); 
        }
      }, (err) => { /* Ignore read errors */ });

      return () => { scanner.clear().catch(e => console.error(e)); };
    }
  }, [activeTab]);

  const showWarning = (msg: string) => {
      setScanWarning(msg);
      setTimeout(() => setScanWarning(''), 3000);
  };

  const handleDecrypt = (fileId: string) => {
    const session = scannedSessions[fileId];
    if(Object.keys(session.chunks).length < session.total) return alert("All puzzles not scanned yet!");
    
    let assembled = "";
    for(let i=1; i<=session.total; i++) assembled += session.chunks[i];
    
    const decryptedDataUrl = decryptFile(assembled, unlockPassword);
    if(!decryptedDataUrl) return alert("Wrong Password! Vault remains locked.");
    
    const a = document.createElement('a');
    a.href = decryptedDataUrl;
    a.download = `CipherVault_Decrypted_${fileId}`;
    a.click();
  };

  const handleMasterClean = async () => {
    if (deleteConfirm !== 'DELETE') return alert("Type DELETE to confirm!");
    setIsDeleting(true);
    await masterCacheClean();
    alert("System completely wiped. Restarting...");
    window.location.reload();
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen border-x border-gray-800 flex flex-col bg-[#09090b]">
      {/* Header - Hidden on Print */}
      <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold flex items-center text-green-400">
          <Shield className="mr-2" /> CipherVault
        </h1>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        
        {/* SEND TAB */}
        {activeTab === 'send' && (
          <div className="space-y-4">
            <div className="print:hidden space-y-4">
                <h2 className="text-lg font-semibold text-white">Create Printable Vault</h2>
                <input type="file" onChange={handleFileUpload} className="w-full p-2 bg-gray-800 text-white rounded border border-gray-700" />
                <input type="password" placeholder="Set Vault Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-2 bg-gray-800 text-white rounded border border-gray-700 outline-none" />
                <button onClick={handleEncryptAndChunk} className="w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded font-bold">Encrypt & Generate Grid</button>
            </div>

            {puzzles.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-4 print:hidden">
                    <h3 className="text-white font-bold">Vault Puzzles ({puzzles.length})</h3>
                    <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        <Printer className="w-4 h-4 mr-2"/> Print Grid
                    </button>
                </div>
                
                {/* GRID FOR PRINTING & SCANNING */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 p-4 bg-white rounded-lg">
                    {puzzles.map((pzl, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                            <QRCodeSVG value={pzl} size={150} level="L" />
                            <p className="text-black text-xs mt-2 font-mono font-bold">{idx + 1} / {puzzles.length}</p>
                        </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCAN TAB - Hidden on Print */}
        {activeTab === 'scan' && (
          <div className="space-y-4 print:hidden">
            <h2 className="text-lg font-semibold text-white">Continuous Scanner</h2>
            {scanWarning && (
                <div className="p-3 bg-red-900/50 border border-red-500 rounded text-red-200 flex items-center font-bold">
                    <AlertTriangle className="mr-2 w-5 h-5"/> {scanWarning}
                </div>
            )}
            <p className="text-sm text-gray-400">Sweep your camera over the puzzle grid. Invalid codes will be blocked.</p>
            <div id="reader" className="w-full bg-black rounded-lg overflow-hidden border border-gray-700"></div>
          </div>
        )}

        {/* HISTORY TAB - Hidden on Print */}
        {activeTab === 'history' && (
          <div className="space-y-4 print:hidden">
            <h2 className="text-lg font-semibold text-white">Local Vaults (History)</h2>
            {Object.keys(scannedSessions).length === 0 ? <p className="text-gray-500">No scanned puzzles yet.</p> : null}
            
            {Object.keys(scannedSessions).map(fileId => {
               const session = scannedSessions[fileId];
               const currentScanned = Object.keys(session.chunks).length;
               const isComplete = currentScanned === session.total;
               
               return (
                 <div key={fileId} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400 font-mono">Vault ID: {fileId}</p>
                    <p className="font-bold my-1 text-green-400">Recovered: {currentScanned} / {session.total}</p>
                    
                    {isComplete ? (
                      <div className="mt-3 space-y-2">
                        <input type="password" placeholder="Enter Vault Password" onChange={(e)=>setUnlockPassword(e.target.value)} className="w-full p-2 bg-gray-900 text-white rounded text-sm border border-gray-700" />
                        <button onClick={() => handleDecrypt(fileId)} className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex justify-center items-center font-bold">
                          <Download className="w-4 h-4 mr-2"/> Decrypt & Download
                        </button>
                      </div>
                    ) : (
                      <div className="w-full bg-gray-900 rounded-full h-2.5 mt-2">
                        <div className="bg-green-500 h-2.5 rounded-full" style={{width: `${(currentScanned/session.total)*100}%`}}></div>
                      </div>
                    )}
                 </div>
               )
            })}
          </div>
        )}

        {/* SETTINGS TAB - Hidden on Print */}
        {activeTab === 'settings' && (
          <div className="space-y-4 print:hidden">
            <h2 className="text-lg font-semibold text-red-500 flex items-center"><Trash2 className="mr-2"/> Danger Zone</h2>
            <div className="p-4 bg-red-950/30 border border-red-900 rounded-lg">
                <p className="text-sm text-gray-300 mb-4">Warning: This will permanently wipe all local history, saved vaults, and service workers.</p>
                <input 
                  type="text" 
                  placeholder="Type DELETE to confirm" 
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="w-full p-2 bg-gray-900 text-white rounded outline-none border border-red-800 mb-3" 
                />
                <button 
                  onClick={handleMasterClean} 
                  disabled={isDeleting}
                  className="w-full p-3 bg-red-600 hover:bg-red-700 text-white rounded font-bold disabled:opacity-50">
                  {isDeleting ? 'Wiping System...' : 'MASTER CACHE CLEAN'}
                </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation - Hidden on Print */}
      <div className="flex border-t border-gray-800 bg-gray-900 p-2 print:hidden">
        <button onClick={() => setActiveTab('send')} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'send' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}><QrCode className="w-5 h-5"/> <span className="text-xs mt-1">Send</span></button>
        <button onClick={() => setActiveTab('scan')} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'scan' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}><QrCode className="w-5 h-5"/> <span className="text-xs mt-1">Scan</span></button>
        <button onClick={() => { setActiveTab('history'); loadHistory(); }} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'history' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}><History className="w-5 h-5"/> <span className="text-xs mt-1">History</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 flex flex-col items-center ${activeTab === 'settings' ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'}`}><Settings className="w-5 h-5"/> <span className="text-xs mt-1">Clean</span></button>
      </div>
    </div>
  );
}
