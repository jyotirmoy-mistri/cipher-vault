"use client";
import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { encryptFile, createPuzzles, formatBytes } from '../utils/vaultLogic';
import { Camera, Image as ImageIcon, FileText, Type, CheckCircle, X, Video, FileAudio, Layers, Shield, FileArchive, Share2, ChevronLeft, ChevronRight, Edit3, Settings2, Download, AlertCircle, Loader2 } from 'lucide-react';

export default function SendTab({ qrConfig }: { qrConfig: any }) {
  const [inputType, setInputType] = useState<'none' | 'file' | 'text'>('none');
  const [fileData, setFileData] = useState<string>('');
  const [textData, setTextData] = useState<string>('');
  const [password, setPassword] = useState('');
  const [density, setDensity] = useState('medium');
  const [vaultName, setVaultName] = useState('Secret_Vault');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [puzzles, setPuzzles] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [splitCount, setSplitCount] = useState(1);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [tempSplitCount, setTempSplitCount] = useState(1);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; 

  // --- NEW: Anti-Freeze Download States ---
  const [confirmModal, setConfirmModal] = useState<{active: boolean, type: 'zip'|'pdf', groupIndex: number, group: string[]} | null>(null);
  const [dlProgress, setDlProgress] = useState({ active: false, current: 0, total: 0, msg: '' });

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if(!file) return;
    let baseName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
    setVaultName(`${baseName}_Vault`);
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => { setFileData(event.target?.result as string); setIsProcessing(false); };
    reader.readAsDataURL(file);
  };

  const handleEncrypt = () => {
    const dataToEncrypt = inputType === 'text' ? textData : fileData;
    if(!dataToEncrypt || !password) return alert("Data & Password required!");
    if(inputType === 'text' && vaultName === 'Secret_Vault') setVaultName('Secret_Message_Vault');

    setIsProcessing(true);
    setTimeout(() => {
        const fileId = "CV_" + Math.random().toString(36).substr(2, 6).toUpperCase();
        const finalData = inputType === 'text' ? `TXT_MSG:${dataToEncrypt}` : dataToEncrypt;
        const { encryptedData, originalSize, compressedSize, savedRatio } = encryptFile(finalData, password);
        setStats({ originalSize, compressedSize, savedRatio });
        const generatedPuzzles = createPuzzles(encryptedData, fileId, density);
        setPuzzles(generatedPuzzles);
        setSplitCount(1); setTempSplitCount(1); setCurrentPage(1);
        setIsProcessing(false);
    }, 150);
  };

  const clearSendForm = () => { 
      setInputType('none'); setFileData(''); setTextData(''); 
      setPassword(''); setPuzzles([]); setStats(null); 
      setCurrentPage(1); setVaultName('Secret_Vault'); setSplitCount(1);
  };

  const saveSplitConfig = () => {
      if(tempSplitCount < 1) return alert("❌ Value must be 1 or greater.");
      if(tempSplitCount > puzzles.length) return alert(`❌ Maximum value is ${puzzles.length}.`);
      setSplitCount(tempSplitCount);
      setIsSplitModalOpen(false);
  };

  const puzzleGroups = splitCount <= 1 ? [puzzles] : Array.from({ length: Math.ceil(puzzles.length / Math.ceil(puzzles.length / splitCount)) }, (v, i) => puzzles.slice(i * Math.ceil(puzzles.length / splitCount), i * Math.ceil(puzzles.length / splitCount) + Math.ceil(puzzles.length / splitCount)));

  // --- ANTI-FREEZE DOWNLOAD ENGINE ---
  const initiateDownload = (group: string[], groupIndex: number, type: 'zip'|'pdf') => {
      setConfirmModal({ active: true, type, groupIndex, group });
  };

  const executeDownload = async () => {
      if(!confirmModal) return;
      const { type, groupIndex, group } = confirmModal;
      setConfirmModal(null);
      setDlProgress({ active: true, current: 0, total: group.length, msg: `Initializing ${type.toUpperCase()} generation...` });

      try {
          const folderName = splitCount > 1 ? `${vaultName}_Part_${groupIndex + 1}` : vaultName;
          const startIndex = splitCount > 1 ? (groupIndex * Math.ceil(puzzles.length / splitCount)) : 0;

          if (type === 'zip') {
              const zip = new JSZip();
              const folder = zip.folder(folderName);
              
              for (let i = 0; i < group.length; i++) {
                  const dataUrl = await QRCode.toDataURL(group[i], { errorCorrectionLevel: qrConfig.level as any, margin: qrConfig.margin, color: { dark: qrConfig.fg, light: qrConfig.bg }});
                  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
                  folder?.file(`QR_${startIndex + i + 1}.png`, base64Data, {base64: true});
                  
                  // Yield to main thread every 10 items to prevent Freezing
                  if (i % 10 === 0) {
                      setDlProgress({ active: true, current: i + 1, total: group.length, msg: `Generating QR codes...` });
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
              
              setDlProgress({ active: true, current: group.length, total: group.length, msg: `Zipping files. Please wait...` });
              await new Promise(r => setTimeout(r, 50)); // Yield before heavy zipping
              
              const content = await zip.generateAsync({type:"blob"});
              saveAs(content, `${folderName}.zip`);

          } else if (type === 'pdf') {
              const pdf = new jsPDF('p', 'mm', 'a4');
              const cols = 3; const rows = 4; 
              const qrSize = 50; const marginX = 20; const marginY = 20;
              const spacingX = 60; const spacingY = 65;

              for (let i = 0; i < group.length; i++) {
                  if (i > 0 && i % (cols * rows) === 0) pdf.addPage();
                  const pageIdx = i % (cols * rows);
                  const col = pageIdx % cols; const row = Math.floor(pageIdx / cols);
                  const x = marginX + col * spacingX; const y = marginY + row * spacingY;
                  
                  const dataUrl = await QRCode.toDataURL(group[i], { errorCorrectionLevel: qrConfig.level as any, margin: qrConfig.margin, color: { dark: qrConfig.fg, light: qrConfig.bg }});
                  pdf.addImage(dataUrl, 'PNG', x, y, qrSize, qrSize);
                  pdf.setFontSize(9);
                  pdf.setTextColor(100);
                  pdf.text(`${vaultName} - P${startIndex + i + 1}/${puzzles.length}`, x, y + qrSize + 5);

                  // Yield to main thread
                  if (i % 10 === 0) {
                      setDlProgress({ active: true, current: i + 1, total: group.length, msg: `Assembling PDF pages...` });
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
              
              setDlProgress({ active: true, current: group.length, total: group.length, msg: `Saving PDF file...` });
              await new Promise(r => setTimeout(r, 50));
              const fileName = splitCount > 1 ? `${vaultName}_PrintBundle_${groupIndex + 1}.pdf` : `${vaultName}_PrintBundle.pdf`;
              pdf.save(fileName);
          }
      } catch (err) {
          alert(`Failed to create ${type.toUpperCase()}.`);
      }
      
      setDlProgress({ active: false, current: 0, total: 0, msg: '' });
  };

  const currentPuzzles = puzzles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(puzzles.length / itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* --- CONFIRMATION MODAL --- */}
      {confirmModal && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
                  <div className="flex justify-center mb-4"><AlertCircle className="w-12 h-12 text-blue-500"/></div>
                  <h3 className="text-xl font-bold mb-2">Confirm Download</h3>
                  <p className="text-sm text-gray-500 mb-6">
                      You are about to generate and download <strong>{confirmModal.group.length} QR Codes</strong> as a <strong>{confirmModal.type.toUpperCase()}</strong> file. This process happens completely offline.
                  </p>
                  <div className="flex space-x-3">
                      <button onClick={()=>setConfirmModal(null)} className="flex-1 p-3 bg-gray-200 dark:bg-gray-800 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                      <button onClick={executeDownload} className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">Yes, Download</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- PROGRESS BAR OVERLAY --- */}
      {dlProgress.active && (
          <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6">
              <Loader2 className="w-16 h-16 text-green-500 animate-spin mb-6"/>
              <h2 className="text-2xl font-black text-white mb-2">{dlProgress.msg}</h2>
              <p className="text-green-400 font-mono text-lg mb-6">{dlProgress.current} / {dlProgress.total} Items</p>
              
              <div className="w-full max-w-sm bg-gray-800 rounded-full h-4 overflow-hidden border border-gray-700 shadow-inner">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-full transition-all duration-300" style={{ width: `${(dlProgress.current / dlProgress.total) * 100 || 0}%` }}></div>
              </div>
              <p className="text-gray-500 text-xs mt-4">Please do not close the browser.</p>
          </div>
      )}

      {/* Dynamic Split Modal */}
      {isSplitModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl">
                  <h3 className="text-xl font-bold mb-2">Configure Separation</h3>
                  <p className="text-xs text-gray-500 mb-6">How many separate bundles do you want to create from these {puzzles.length} QRs?</p>
                  <input type="number" min="1" max={puzzles.length} value={tempSplitCount} onChange={(e)=>setTempSplitCount(Number(e.target.value))} className="w-full p-4 text-center text-2xl font-black bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl mb-6 outline-none focus:border-green-500" />
                  <div className="flex space-x-3">
                      <button onClick={()=>setIsSplitModalOpen(false)} className="flex-1 p-4 bg-gray-200 dark:bg-gray-800 rounded-xl font-bold">Cancel</button>
                      <button onClick={saveSplitConfig} className="flex-1 p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold">Apply</button>
                  </div>
              </div>
          </div>
      )}

      {inputType === 'none' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Camera className="w-6 h-6 text-blue-500 mb-2"/> <span className="text-xs font-bold">Live Photo</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Video className="w-6 h-6 text-red-500 mb-2"/> <span className="text-xs font-bold">Live Video</span><input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><ImageIcon className="w-6 h-6 text-pink-500 mb-2"/> <span className="text-xs font-bold">Image File</span><input type="file" accept="image/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Video className="w-6 h-6 text-purple-500 mb-2"/> <span className="text-xs font-bold">Video File</span><input type="file" accept="video/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><FileAudio className="w-6 h-6 text-yellow-500 mb-2"/> <span className="text-xs font-bold">Audio File</span><input type="file" accept="audio/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><FileText className="w-6 h-6 text-orange-500 mb-2"/> <span className="text-xs font-bold">Document</span><input type="file" accept=".pdf,.doc,.docx,.txt,.xls" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} /></label>
              <button onClick={() => setInputType('text')} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:scale-105 transition-all col-span-2 shadow-sm"><Type className="w-6 h-6 text-green-500 mb-2"/> <span className="text-xs font-bold">Secret Text Message</span></button>
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
                  <input type="text" value={vaultName} onChange={(e)=>setVaultName(e.target.value)} className="w-full bg-transparent outline-none font-bold text-blue-600 dark:text-blue-400" />
              </div>
              {inputType === 'text' ? (
                  <textarea placeholder="Type secret message..." value={textData} onChange={(e)=>setTextData(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800 h-32" />
              ) : (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl flex items-center border border-green-200 dark:border-green-800/50">
                      <CheckCircle className="w-5 h-5 mr-2"/> <span className="text-sm font-bold truncate">Data Loaded successfully.</span>
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
                              {/* --- MODIFIED TO TRIGGER CONFIRMATION MODAL --- */}
                              <button onClick={() => initiateDownload(group, idx, 'zip')} disabled={dlProgress.active} className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"><FileArchive className="w-4 h-4 mr-1"/> ZIP</button>
                              <button onClick={() => initiateDownload(group, idx, 'pdf')} disabled={dlProgress.active} className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"><FileText className="w-4 h-4 mr-1"/> PDF</button>
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
