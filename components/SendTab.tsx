"use client";
import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { encryptFile, createPuzzles, formatBytes } from '../utils/vaultLogic';
import { Camera, Image as ImageIcon, FileText, Type, CheckCircle, X, Video, FileAudio, Layers, Shield, FileArchive, Share2, ChevronLeft, ChevronRight, Edit3, Settings2, AlertCircle, Server, Zap, Minus, Maximize2 } from 'lucide-react';

export default function SendTab({ qrConfig }: { qrConfig: any }) {
  const [inputType, setInputType] = useState<'none' | 'file' | 'text' | 'audio'>('none');
  const [fileData, setFileData] = useState<string>('');
  const [textData, setTextData] = useState<string>('');
  const [previews, setPreviews] = useState<{type: string, url: string, name: string}[]>([]);
  const [password, setPassword] = useState('');
  const [density, setDensity] = useState('medium');
  const [vaultName, setVaultName] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [puzzles, setPuzzles] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [splitCount, setSplitCount] = useState(1);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [tempSplitCount, setTempSplitCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; 

  const [confirmModal, setConfirmModal] = useState<{active: boolean, type: 'zip'|'pdf', groupIndex: number, group: string[]} | null>(null);
  const [dlProgress, setDlProgress] = useState({ active: false, current: 0, total: 0, msg: '', minimized: false });

  // 🚀 FEATURE: Session Persistence (Survive Page Refresh)
  useEffect(() => {
      const savedSession = sessionStorage.getItem('cv_current_vault');
      if (savedSession) {
          try {
              const data = JSON.parse(savedSession);
              setPuzzles(data.puzzles); setVaultName(data.vaultName); setStats(data.stats);
          } catch(e) {}
      }
  }, []);

  useEffect(() => {
      if (puzzles.length > 0) {
          sessionStorage.setItem('cv_current_vault', JSON.stringify({ puzzles, vaultName, stats }));
      } else {
          sessionStorage.removeItem('cv_current_vault');
      }
  }, [puzzles, vaultName, stats]);

  const handleFileUpload = async (e: any, type: string) => {
    const files = Array.from(e.target.files).slice(0, 3) as File[];
    if(files.length === 0) return;
    setInputType('file'); setIsProcessing(true);

    const firstFile = files[0];
    const ext = firstFile.name.split('.').pop() || 'file';
    const base = firstFile.name.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 10);
    const prefix = firstFile.type.startsWith('image') ? 'IMG' : firstFile.type.startsWith('video') ? 'VID' : firstFile.type.startsWith('audio') ? 'AUD' : 'DOC';
    setVaultName(files.length > 1 ? `MULTI_${prefix}_${Math.random().toString(36).substr(2, 4).toUpperCase()}_Vault` : `${prefix}_${base}_${Math.random().toString(36).substr(2, 4).toUpperCase()}_Vault`);

    const newPreviews = files.map(f => ({ type: f.type.split('/')[0], url: URL.createObjectURL(f), name: f.name }));
    setPreviews(newPreviews);

    const readAsDataURL = (file: File) => new Promise<string>((resolve) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file);
    });

    const b64Array = await Promise.all(files.map(readAsDataURL));
    setFileData(JSON.stringify({ isMulti: files.length > 1, data: b64Array }));
    setIsProcessing(false);
    e.target.value = '';
  };

  const handleEncrypt = () => {
    let finalData = inputType === 'text' ? `TXT_MSG:${textData}` : fileData;
    if(!finalData || !password) return alert("Data & Password required!");
    if(inputType === 'text' && !vaultName) setVaultName(`TXT_SecretMsg_${Math.random().toString(36).substr(2, 4).toUpperCase()}`);

    setIsProcessing(true);
    setTimeout(() => {
        const fileId = "CV_" + Math.random().toString(36).substr(2, 6).toUpperCase();
        const { encryptedData, originalSize, compressedSize, savedRatio } = encryptFile(finalData, password);
        setStats({ originalSize, compressedSize, savedRatio });
        setPuzzles(createPuzzles(encryptedData, fileId, density));
        setSplitCount(1); setTempSplitCount(1); setCurrentPage(1);
        setIsProcessing(false);
    }, 150);
  };

  const clearSendForm = () => { 
      setInputType('none'); setFileData(''); setTextData(''); setPassword(''); setPuzzles([]); setStats(null); setPreviews([]);
      setCurrentPage(1); setVaultName(''); setSplitCount(1); sessionStorage.removeItem('cv_current_vault');
  };

  const puzzleGroups = splitCount <= 1 ? [puzzles] : Array.from({ length: Math.ceil(puzzles.length / Math.ceil(puzzles.length / splitCount)) }, (v, i) => puzzles.slice(i * Math.ceil(puzzles.length / splitCount), i * Math.ceil(puzzles.length / splitCount) + Math.ceil(puzzles.length / splitCount)));

  const initiateDownload = (group: string[], groupIndex: number, type: 'zip'|'pdf') => setConfirmModal({ active: true, type, groupIndex, group });

  // 🚀 FEATURE: Super-Fast Anti-Throttling Download Engine
  const executeDownload = async () => {
      if(!confirmModal) return;
      const { type, groupIndex, group } = confirmModal;
      setConfirmModal(null);
      setDlProgress({ active: true, current: 0, total: group.length, msg: `Initializing Core...`, minimized: false });

      let wakeLock: any = null;
      try {
          if ('wakeLock' in navigator) wakeLock = await (navigator as any).wakeLock.request('screen'); // Keep screen awake
          
          const folderName = splitCount > 1 ? `${vaultName}_Part_${groupIndex + 1}` : vaultName;
          const startIndex = splitCount > 1 ? (groupIndex * Math.ceil(puzzles.length / splitCount)) : 0;

          if (type === 'zip') {
              const zip = new JSZip();
              const folder = zip.folder(folderName);
              for (let i = 0; i < group.length; i++) {
                  const dataUrl = await QRCode.toDataURL(group[i], { errorCorrectionLevel: qrConfig.level as any, margin: qrConfig.margin, color: { dark: qrConfig.fg, light: qrConfig.bg }});
                  folder?.file(`QR_${startIndex + i + 1}.png`, dataUrl.replace(/^data:image\/png;base64,/, ""), {base64: true});
                  
                  // SMART BATCHING: If app is minimized, process 100 at a time to bypass browser limits. If open, update UI every 10 items.
                  const batchSize = document.hidden ? 100 : 15;
                  if (i % batchSize === 0) {
                      setDlProgress(prev => ({ ...prev, current: i + 1, msg: `Compiling QRs...` }));
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
              setDlProgress(prev => ({ ...prev, current: group.length, msg: `Compressing Data Archive...` }));
              await new Promise(r => setTimeout(r, 50)); 
              const content = await zip.generateAsync({type:"blob"});
              saveAs(content, `${folderName}.zip`);

          } else if (type === 'pdf') {
              const pdf = new jsPDF('p', 'mm', 'a4');
              const cols = 3; const rows = 4; const qrSize = 50; const marginX = 20; const marginY = 20; const spacingX = 60; const spacingY = 65;

              for (let i = 0; i < group.length; i++) {
                  if (i > 0 && i % (cols * rows) === 0) pdf.addPage();
                  const pageIdx = i % (cols * rows);
                  const x = marginX + (pageIdx % cols) * spacingX; const y = marginY + Math.floor(pageIdx / cols) * spacingY;
                  
                  const dataUrl = await QRCode.toDataURL(group[i], { errorCorrectionLevel: qrConfig.level as any, margin: qrConfig.margin, color: { dark: qrConfig.fg, light: qrConfig.bg }});
                  pdf.addImage(dataUrl, 'PNG', x, y, qrSize, qrSize);
                  pdf.setFontSize(9); pdf.setTextColor(100);
                  pdf.text(`${vaultName} - P${startIndex + i + 1}/${puzzles.length}`, x, y + qrSize + 5);

                  const batchSize = document.hidden ? 50 : 10;
                  if (i % batchSize === 0) {
                      setDlProgress(prev => ({ ...prev, current: i + 1, msg: `Printing PDF Pages...` }));
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
              setDlProgress(prev => ({ ...prev, current: group.length, msg: `Finalizing PDF...` }));
              await new Promise(r => setTimeout(r, 50));
              pdf.save(splitCount > 1 ? `${vaultName}_PrintBundle_${groupIndex + 1}.pdf` : `${vaultName}_PrintBundle.pdf`);
          }
      } catch (err) { 
          alert(`Failed to complete download. Error processing massive data.`); 
      } finally {
          // GUARANTEED TO RUN: Closes the loading animation
          if (wakeLock !== null) wakeLock.release().catch(()=>{});
          setDlProgress({ active: false, current: 0, total: 0, msg: '', minimized: false });
      }
  };

  const currentPuzzles = puzzles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(puzzles.length / itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* CONFIRMATION MODAL */}
      {confirmModal && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
                  <div className="flex justify-center mb-4"><AlertCircle className="w-12 h-12 text-blue-500"/></div>
                  <h3 className="text-xl font-bold mb-2">Confirm Data Export</h3>
                  <p className="text-sm text-gray-500 mb-6">Generating <strong>{confirmModal.group.length} Secured QRs</strong> into a <strong>{confirmModal.type.toUpperCase()}</strong> file format. This process runs securely offline.</p>
                  <div className="flex space-x-3">
                      <button onClick={()=>setConfirmModal(null)} className="flex-1 p-3 bg-gray-200 dark:bg-gray-800 rounded-xl font-bold">Cancel</button>
                      <button onClick={executeDownload} className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Start Export</button>
                  </div>
              </div>
          </div>
      )}

      {/* 🚀 BEAUTIFUL NEW DOWNLOAD PROGRESS UI */}
      {dlProgress.active && !dlProgress.minimized && (
          <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center">
              <button onClick={() => setDlProgress({...dlProgress, minimized: true})} className="absolute top-6 right-6 p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white transition-all"><Minus className="w-6 h-6"/></button>
              
              <div className="relative mb-8">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full"></div>
                  <Server className="w-20 h-20 text-blue-400 relative z-10 animate-pulse"/>
                  <Zap className="w-8 h-8 text-green-400 absolute bottom-0 right-0 animate-bounce z-20"/>
              </div>

              <h2 className="text-2xl font-black text-white mb-2">{dlProgress.msg}</h2>
              <p className="text-blue-400 font-mono text-xl mb-8 tracking-widest">{dlProgress.current} <span className="text-gray-500 text-sm">/ {dlProgress.total}</span></p>
              
              <div className="w-full max-w-sm bg-gray-900 rounded-full h-3 overflow-hidden border border-gray-800 shadow-inner relative">
                  <div className="bg-gradient-to-r from-blue-600 via-green-400 to-emerald-400 h-full transition-all duration-300 relative overflow-hidden" style={{ width: `${(dlProgress.current / dlProgress.total) * 100 || 0}%` }}>
                      <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/20 -skew-x-12 translate-x-[-100%] animate-[shimmer_1s_infinite]"></div>
                  </div>
              </div>
              <p className="text-gray-400 text-xs mt-6 bg-gray-900 border border-gray-800 px-4 py-2 rounded-xl flex items-center"><Shield className="w-3 h-3 mr-2"/> Encrypted Processing Active (Offline)</p>
          </div>
      )}

      {/* MINIMIZED FLOATER */}
      {dlProgress.active && dlProgress.minimized && (
          <div onClick={() => setDlProgress({...dlProgress, minimized: false})} className="fixed top-24 right-4 z-[70] bg-gray-900 border border-gray-700 p-4 rounded-2xl shadow-2xl cursor-pointer hover:scale-105 flex items-center space-x-4">
              <Server className="w-6 h-6 text-blue-400 animate-pulse"/>
              <div>
                  <p className="text-xs font-bold text-white mb-1">Exporting Data...</p>
                  <div className="w-24 bg-gray-800 rounded-full h-1.5 overflow-hidden"><div className="bg-blue-500 h-full transition-all" style={{ width: `${(dlProgress.current / dlProgress.total) * 100 || 0}%` }}></div></div>
              </div>
              <Maximize2 className="w-4 h-4 text-gray-500"/>
          </div>
      )}

      {/* DYNAMIC SPLIT MODAL */}
      {isSplitModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl">
                  <h3 className="text-xl font-bold mb-2">Configure Bundle Separation</h3>
                  <p className="text-xs text-gray-500 mb-6">How many separate bundles do you want?</p>
                  <input type="number" min="1" max={puzzles.length} value={tempSplitCount} onChange={(e)=>setTempSplitCount(Number(e.target.value))} className="w-full p-4 text-center text-2xl font-black bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl mb-6 outline-none focus:border-green-500" />
                  <div className="flex space-x-3">
                      <button onClick={()=>setIsSplitModalOpen(false)} className="flex-1 p-4 bg-gray-200 dark:bg-gray-800 rounded-xl font-bold">Cancel</button>
                      <button onClick={() => {if(tempSplitCount<1||tempSplitCount>puzzles.length)return alert("Invalid count!"); setSplitCount(tempSplitCount); setIsSplitModalOpen(false);}} className="flex-1 p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold">Apply</button>
                  </div>
              </div>
          </div>
      )}

      {/* ... (The rest of the UI for Input Buttons, Preview, and Rendered Grid remains identical) ... */}
      {inputType === 'none' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Camera className="w-6 h-6 text-blue-500 mb-2"/> <span className="text-xs font-bold">Live Photo</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>handleFileUpload(e, 'image')} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Video className="w-6 h-6 text-red-500 mb-2"/> <span className="text-xs font-bold">Live Video</span><input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>handleFileUpload(e, 'video')} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><ImageIcon className="w-6 h-6 text-pink-500 mb-2"/> <span className="text-xs font-bold">Gallery</span><input type="file" accept="image/*, video/*" multiple className="hidden" onChange={(e)=>handleFileUpload(e, 'media')} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><FileText className="w-6 h-6 text-orange-500 mb-2"/> <span className="text-xs font-bold">Document</span><input type="file" accept=".pdf,.doc,.txt" className="hidden" onChange={(e)=>handleFileUpload(e, 'document')} /></label>
              <button onClick={() => setInputType('text')} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:scale-105 transition-all col-span-4 shadow-sm"><Type className="w-6 h-6 text-green-500 mb-2"/> <span className="text-xs font-bold">Secret Text Message</span></button>
          </div>
      )}

      {inputType !== 'none' && puzzles.length === 0 && (
          <div className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold flex items-center"><Shield className="w-5 h-5 mr-2 text-green-500"/> Vault Settings</h3>
                  <button onClick={clearSendForm} className="text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded-xl"><X className="w-5 h-5"/></button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center">
                  <Edit3 className="w-5 h-5 text-blue-500 mr-2"/>
                  <input type="text" value={vaultName} onChange={(e)=>setVaultName(e.target.value)} placeholder="Vault Name" className="w-full bg-transparent outline-none font-bold text-blue-600 dark:text-blue-400" />
              </div>
              {inputType === 'text' ? (
                  <textarea placeholder="Type secret message..." value={textData} onChange={(e)=>setTextData(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800 h-32" />
              ) : (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl flex items-center border border-green-200 dark:border-green-800/50">
                      <CheckCircle className="w-5 h-5 mr-2"/> <span className="text-sm font-bold truncate">Data Loaded. Ready.</span>
                  </div>
              )}
              <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                  <label className="text-xs text-gray-500 font-bold mb-2 block flex items-center"><Layers className="w-4 h-4 mr-1"/> QR Density</label>
                  <select value={density} onChange={(e)=>setDensity(e.target.value)} className="w-full bg-transparent outline-none font-bold">
                      <option value="low">Low Density (Many QRs, Easy to Scan)</option>
                      <option value="medium">Medium Density (Balanced)</option>
                      <option value="high">High Density (Fewer QRs, Clear Print)</option>
                  </select>
              </div>
              <input type="password" placeholder="Enter Vault Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800 font-bold" />
              <button onClick={handleEncrypt} disabled={isProcessing} className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black shadow-lg transition-all">
                  {isProcessing ? "Processing Vault..." : "ENCRYPT & GENERATE"}
              </button>
          </div>
      )}

      {puzzles.length > 0 && (
        <div className="space-y-4">
          <div className="bg-gray-900 dark:bg-black p-5 rounded-3xl border border-gray-800 shadow-xl">
              <div className="flex justify-between items-start mb-4">
                  <div>
                      <h3 className="text-xl font-black text-green-500">{vaultName}</h3>
                      <p className="text-xs text-gray-400 mt-1">{puzzles.length} Total QRs • Saved {stats?.savedRatio}% data</p>
                  </div>
                  <button onClick={clearSendForm} className="px-3 py-1 bg-red-900/50 text-red-400 rounded-lg text-xs font-bold">Clear</button>
              </div>

              <div className="bg-gray-800/50 p-3 rounded-xl mb-4 border border-gray-700 flex items-center justify-between">
                  <div className="flex items-center"><Share2 className="w-4 h-4 text-blue-400 mr-2"/><span className="text-xs font-bold text-gray-300">Bundle Separation: {splitCount} Groups</span></div>
                  <button onClick={() => { setTempSplitCount(splitCount); setIsSplitModalOpen(true); }} className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white"><Settings2 className="w-4 h-4"/></button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                  {puzzleGroups.map((group, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-2 bg-gray-800/30 p-3 rounded-xl border border-gray-800">
                          <div className="flex-1 flex items-center justify-between px-2 mb-2 md:mb-0">
                             <span className="font-bold text-sm text-gray-300">{splitCount > 1 ? `Bundle ${idx + 1}` : 'Full Vault'}</span>
                             <span className="text-xs bg-black/40 text-gray-400 px-2 py-1 rounded-lg">{group.length} QRs</span>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => initiateDownload(group, idx, 'zip')} className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"><FileArchive className="w-4 h-4 mr-1"/> ZIP</button>
                              <button onClick={() => initiateDownload(group, idx, 'pdf')} className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold"><FileText className="w-4 h-4 mr-1"/> PDF</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
              {currentPuzzles.map((pzl, idx) => {
                  const actualIndex = (currentPage - 1) * itemsPerPage + idx;
                  return (
                      <div key={actualIndex} className="flex flex-col items-center p-3 border border-gray-100 dark:border-gray-800 rounded-xl" style={{ backgroundColor: qrConfig.bg }}>
                          <div style={{ padding: `${qrConfig.margin || 2}px`, backgroundColor: qrConfig.bg }} className="rounded-lg">
                              <QRCodeSVG value={pzl} size={140} fgColor={qrConfig.fg} bgColor={qrConfig.bg} level={qrConfig.level as any} />
                          </div>
                          <p className="text-xs mt-2 font-mono font-bold" style={{ color: qrConfig.fg }}>Part {actualIndex + 1}/{puzzles.length}</p>
                      </div>
                  )
              })}
          </div>

          {totalPages > 1 && (
              <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-30"><ChevronLeft className="w-6 h-6"/></button>
                  <span className="font-bold font-mono text-sm">Page {currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-30"><ChevronRight className="w-6 h-6"/></button>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
