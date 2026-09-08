"use client";
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { encryptFile, decryptFile, createPuzzles, masterCacheClean } from '../utils/vaultLogic';
import localforage from 'localforage';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
    Shield, QrCode, History, Trash2, Settings, Download, Printer, 
    AlertTriangle, Camera, Image as ImageIcon, FileText, Type, CheckCircle, ImageDown
} from 'lucide-react';

export default function CipherVault() {
  const [activeTab, setActiveTab] = useState('send');
  
  // Dynamic Inputs
  const [inputType, setInputType] = useState<'none' | 'file' | 'text'>('none');
  const [fileData, setFileData] = useState<string>('');
  const [textData, setTextData] = useState<string>('');
  const [password, setPassword] = useState('');
  
  // Status & Puzzles
  const [isProcessing, setIsProcessing] = useState(false);
  const [puzzles, setPuzzles] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Scan & History
  const [scannedSessions, setScannedSessions] = useState<any>({});
  const [unlockPassword, setUnlockPassword] = useState('');
  const [scanWarning, setScanWarning] = useState('');
  
  // Settings
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => { loadHistory(); }, []);
  const loadHistory = async () => { setScannedSessions(await localforage.getItem('scan_history') || {}); };

  // --- SMART VALIDATION & UPLOAD ---
  const handleFileUpload = async (e: any, expectedType: string) => {
    const file = e.target.files[0];
    if(!file) return;

    // Fake PDF Checker (Magic Numbers)
    if (file.type === "application/pdf" || expectedType === 'pdf') {
        const buffer = await file.slice(0, 4).arrayBuffer();
        const header = new Uint8Array(buffer);
        const isTruePDF = header[0]===0x25 && header[1]===0x50 && header[2]===0x44 && header[3]===0x46; // "%PDF"
        if (!isTruePDF) return alert("❌ Fake or Corrupted PDF Detected! Upload rejected.");
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
        setFileData(event.target?.result as string);
        setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleEncrypt = () => {
    const dataToEncrypt = inputType === 'text' ? textData : fileData;
    if(!dataToEncrypt || !password) return alert("Data & Password required!");
    
    setIsProcessing(true);
    setTimeout(() => {
        const fileId = "CV_" + Math.random().toString(36).substr(2, 6).toUpperCase();
        // Add prefix for text files so we know how to download it later
        const finalData = inputType === 'text' ? `TXT_MSG:${dataToEncrypt}` : dataToEncrypt;
        
        const encrypted = encryptFile(finalData, password);
        setPuzzles(createPuzzles(encrypted, fileId));
        setIsProcessing(false);
    }, 500); // Skeleton loading effect
  };

  // --- MASS SCANNER (Auto Assembly) ---
  useEffect(() => {
    if (activeTab === 'scan') {
      const scanner = new Html5QrcodeScanner("reader", { 
          fps: 20, // High FPS for sweeping
          qrbox: {width: 250, height: 250},
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      }, false);

      scanner.render(async (decodedText) => {
        try {
          const parsed = JSON.parse(decodedText);
          if(parsed.cv_sig === "CipherVault_v2" && parsed.id) {
             setScanWarning('');
             const history: any = await localforage.getItem('scan_history') || {};
             if(!history[parsed.id]) history[parsed.id] = { total: parsed.total, chunks: {} };
             
             // Avoid unnecessary state updates if chunk already exists
             if(!history[parsed.id].chunks[parsed.part]) {
                 history[parsed.id].chunks[parsed.part] = parsed.data;
                 await localforage.setItem('scan_history', history);
                 setScannedSessions({...history});
             }
          } else { showWarning("⚠️ Not a valid CipherVault Code!"); }
        } catch(e) { showWarning("⚠️ Unknown QR Format!"); }
      }, () => {});

      return () => { scanner.clear().catch(e => console.error(e)); };
    }
  }, [activeTab]);

  const showWarning = (msg: string) => {
      setScanWarning(msg);
      setTimeout(() => setScanWarning(''), 3000);
  };

  // --- EXPORT FUNCTIONS ---
  const downloadAsPNG = async () => {
      if(!gridRef.current) return;
      const canvas = await html2canvas(gridRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = 'CipherVault_Grid.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
  };

  const downloadAsPDF = async () => {
      if(!gridRef.current) return;
      const canvas = await html2canvas(gridRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('CipherVault_Grid.pdf');
  };

  const handleDecrypt = (fileId: string) => {
    const session = scannedSessions[fileId];
    if(Object.keys(session.chunks).length < session.total) return alert("Puzzles incomplete!");
    
    let assembled = "";
    for(let i=1; i<=session.total; i++) assembled += session.chunks[i];
    
    const decrypted = decryptFile(assembled, unlockPassword);
    if(!decrypted) return alert("❌ Wrong Password! Vault remains locked.");
    
    if(decrypted.startsWith("TXT_MSG:")) {
        alert("Encrypted Text: \n\n" + decrypted.replace("TXT_MSG:", ""));
    } else {
        const a = document.createElement('a');
        a.href = decrypted;
        a.download = `CipherVault_Decrypted_${fileId}`;
        a.click();
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-green-500/30">
      
      {/* Top Navigation */}
      <div className="p-5 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between sticky top-0 z-50 print:hidden">
        <h1 className="text-2xl font-black flex items-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
          <Shield className="mr-2 text-green-500" strokeWidth={2.5} /> CipherVault 4.0
        </h1>
      </div>

      <div className="flex-1 p-5 overflow-y-auto pb-24">
        
        {/* SEND TAB */}
        {activeTab === 'send' && (
          <div className="space-y-6 print:hidden">
            
            {/* Dynamic Action Buttons */}
            <div className="grid grid-cols-4 gap-3">
                <label className="flex flex-col items-center justify-center p-4 bg-gray-900 border border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-800 transition-all">
                    <Camera className="w-6 h-6 text-blue-400 mb-2"/> <span className="text-xs font-semibold">Camera</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=> {setInputType('file'); handleFileUpload(e, 'image');}} />
                </label>
                <label className="flex flex-col items-center justify-center p-4 bg-gray-900 border border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-800 transition-all">
                    <ImageIcon className="w-6 h-6 text-pink-400 mb-2"/> <span className="text-xs font-semibold">Gallery</span>
                    <input type="file" accept="image/*, video/*" className="hidden" onChange={(e)=> {setInputType('file'); handleFileUpload(e, 'media');}} />
                </label>
                <label className="flex flex-col items-center justify-center p-4 bg-gray-900 border border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-800 transition-all">
                    <FileText className="w-6 h-6 text-orange-400 mb-2"/> <span className="text-xs font-semibold">PDF/Doc</span>
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e)=> {setInputType('file'); handleFileUpload(e, 'pdf');}} />
                </label>
                <button onClick={() => setInputType('text')} className="flex flex-col items-center justify-center p-4 bg-gray-900 border border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-800 transition-all">
                    <Type className="w-6 h-6 text-green-400 mb-2"/> <span className="text-xs font-semibold">Secret Text</span>
                </button>
            </div>

            {/* Input Fields */}
            {inputType !== 'none' && (
                <div className="p-5 bg-gray-900 rounded-2xl border border-gray-800 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    {inputType === 'text' ? (
                        <textarea placeholder="Type secret message here..." value={textData} onChange={(e)=>setTextData(e.target.value)} className="w-full p-4 bg-gray-950 rounded-xl border border-gray-800 focus:border-green-500 outline-none resize-none h-32" />
                    ) : (
                        <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 flex items-center">
                            {fileData ? <CheckCircle className="text-green-500 mr-2"/> : <div className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin mr-2"/>}
                            <span className="text-sm truncate">{fileData ? "File loaded and verified successfully." : "Waiting for file..."}</span>
                        </div>
                    )}
                    
                    <input type="password" placeholder="Set Military-Grade Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-4 bg-gray-950 rounded-xl border border-gray-800 focus:border-green-500 outline-none" />
                    
                    <button onClick={handleEncrypt} disabled={isProcessing} className="w-full p-4 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 rounded-xl font-bold text-white shadow-lg shadow-green-900/50 transition-all disabled:opacity-50 flex justify-center">
                        {isProcessing ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/> : "Encrypt & Generate Vault"}
                    </button>
                </div>
            )}

            {/* Generated Puzzles Grid */}
            {puzzles.length > 0 && !isProcessing && (
              <div className="mt-8 animate-in fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Encrypted Grid ({puzzles.length} pieces)</h3>
                    <div className="flex space-x-2">
                        <button onClick={downloadAsPNG} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400" title="Download PNG"><ImageDown className="w-5 h-5"/></button>
                        <button onClick={downloadAsPDF} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-orange-400" title="Download PDF"><FileText className="w-5 h-5"/></button>
                        <button onClick={() => window.print()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300" title="Print"><Printer className="w-5 h-5"/></button>
                    </div>
                </div>
                
                {/* Visual Grid for Export */}
                <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 gap-6 p-6 bg-white rounded-2xl">
                    {puzzles.map((pzl, idx) => (
                        <div key={idx} className="flex flex-col items-center p-2 border-2 border-dashed border-gray-200 rounded-xl">
                            <QRCodeSVG value={pzl} size={150} level="L" />
                            <p className="text-gray-500 text-xs mt-2 font-mono font-bold">PZL-{idx + 1}/{puzzles.length}</p>
                        </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCAN TAB */}
        {activeTab === 'scan' && (
          <div className="space-y-6 print:hidden">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Mass Scanner</h2>
                {scanWarning && <span className="text-xs bg-red-900/50 text-red-400 px-3 py-1 rounded-full border border-red-800 animate-pulse">{scanWarning}</span>}
            </div>
            <p className="text-sm text-gray-400">Sweep your camera over the puzzle grid. The system will auto-assemble all pieces.</p>
            <div className="bg-gray-900 p-2 rounded-3xl border border-gray-800 shadow-2xl">
                <div id="reader" className="w-full rounded-2xl overflow-hidden bg-black [&>div]:border-none [&>div]:!bg-black"></div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-5 print:hidden">
            <h2 className="text-xl font-bold">Recovered Vaults</h2>
            {Object.keys(scannedSessions).length === 0 ? (
                <div className="p-10 border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-600">
                    <History className="w-12 h-12 mb-3"/>
                    <p>No vaults found in local storage.</p>
                </div>
            ) : null}
            
            {Object.keys(scannedSessions).map(fileId => {
               const session = scannedSessions[fileId];
               const currentScanned = Object.keys(session.chunks).length;
               const isComplete = currentScanned === session.total;
               const progress = (currentScanned/session.total)*100;
               
               return (
                 <div key={fileId} className="p-5 bg-gray-900 rounded-2xl border border-gray-800 hover:border-gray-700 transition-all">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-mono text-gray-400">{fileId}</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${isComplete ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}`}>
                            {isComplete ? 'Ready' : 'Scanning'}
                        </span>
                    </div>
                    
                    <p className="font-bold text-lg mb-3">{currentScanned} of {session.total} Pieces Found</p>
                    
                    {isComplete ? (
                      <div className="flex space-x-2">
                        <input type="password" placeholder="Vault Password" onChange={(e)=>setUnlockPassword(e.target.value)} className="flex-1 p-3 bg-gray-950 rounded-xl border border-gray-800 focus:border-green-500 outline-none" />
                        <button onClick={() => handleDecrypt(fileId)} className="px-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white transition-all"><Download className="w-5 h-5"/></button>
                      </div>
                    ) : (
                      <div className="w-full bg-gray-950 rounded-full h-3 border border-gray-800 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
                      </div>
                    )}
                 </div>
               )
            })}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6 print:hidden">
            <h2 className="text-xl font-bold text-red-500 flex items-center"><Trash2 className="mr-2"/> Danger Zone</h2>
            <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-3xl">
                <p className="text-gray-400 mb-6 leading-relaxed">This action will completely format the CipherVault storage. All locally saved puzzles, history, and cache will be permanently wiped.</p>
                <input 
                  type="text" 
                  placeholder="Type DELETE" 
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="w-full p-4 bg-gray-950 text-red-400 font-mono rounded-xl outline-none border border-red-900/50 mb-4 focus:border-red-500" 
                />
                <button 
                  onClick={async () => {
                      if(deleteConfirm !== 'DELETE') return alert('Type DELETE exactly.');
                      await masterCacheClean();
                      window.location.reload();
                  }} 
                  className="w-full p-4 bg-red-900 hover:bg-red-800 text-white rounded-xl font-bold transition-all">
                  FORMAT VAULT
                </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent print:hidden pointer-events-none">
        <div className="max-w-md mx-auto bg-gray-900/90 backdrop-blur-xl border border-gray-800 rounded-3xl p-2 flex justify-between shadow-2xl pointer-events-auto">
            {['send', 'scan', 'history', 'settings'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)} 
                    className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${activeTab === tab ? 'bg-gray-800 text-green-400 scale-105' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}>
                    {tab === 'send' && <QrCode className="w-6 h-6"/>}
                    {tab === 'scan' && <Camera className="w-6 h-6"/>}
                    {tab === 'history' && <History className="w-6 h-6"/>}
                    {tab === 'settings' && <Settings className="w-6 h-6"/>}
                </button>
            ))}
        </div>
      </div>
    </div>
  );
}
