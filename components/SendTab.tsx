"use client";
import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { encryptFile, createPuzzles, formatBytes } from '../utils/vaultLogic';
import localforage from 'localforage';
import { Camera, Image as ImageIcon, FileText, Type, CheckCircle, X, Video, FileAudio, Layers, Shield, FileArchive, Share2, ChevronLeft, ChevronRight, Edit3, Settings2, AlertCircle, Loader2, Minus, Maximize2, Mic, StopCircle, Zap, Cloud, WifiOff, Download, Server } from 'lucide-react';

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
  const [dlProgress, setDlProgress] = useState({ active: false, current: 0, total: 0, msg: '', percent: 0, minimized: false });

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // 🚀 FIX: Upgraded to LocalForage (IndexedDB) for Unlimited Draft Storage (Fixes 5MB Crash)
  useEffect(() => {
      localforage.getItem('cv_draft_vault').then((savedSession: any) => {
          if (savedSession && savedSession.puzzles) {
              setPuzzles(savedSession.puzzles); setVaultName(savedSession.vaultName); setStats(savedSession.stats);
          }
      }).catch(e => console.error("Draft load error:", e));
  }, []);

  useEffect(() => {
      if (puzzles.length > 0) {
          // Wrapped in try/catch to ensure UI never breaks
          localforage.setItem('cv_draft_vault', { puzzles, vaultName, stats }).catch(e => console.error("Draft save error:", e));
      } else {
          localforage.removeItem('cv_draft_vault').catch(e => console.error(e));
      }
  }, [puzzles, vaultName, stats]);

  const handleFileUpload = async (e: any, type: string) => {
    const files = Array.from(e.target.files).slice(0, 3) as File[];
    if(files.length === 0) return;
    setInputType('file'); setIsProcessing(true);
    
    try {
        const firstFile = files[0]; const ext = firstFile.name.split('.').pop() || 'file';
        const base = firstFile.name.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 10);
        const prefix = firstFile.type.startsWith('image') ? 'IMG' : firstFile.type.startsWith('video') ? 'VID' : firstFile.type.startsWith('audio') ? 'AUD' : 'DOC';
        setVaultName(files.length > 1 ? `MULTI_${prefix}_${Math.random().toString(36).substr(2, 4).toUpperCase()}_Vault` : `${prefix}_${base}_${Math.random().toString(36).substr(2, 4).toUpperCase()}_Vault`);
        setPreviews(files.map(f => ({ type: f.type.split('/')[0], url: URL.createObjectURL(f), name: f.name })));
        
        const readAsDataURL = (file: File) => new Promise<string>((resolve, reject) => { 
            const reader = new FileReader(); 
            reader.onload = () => resolve(reader.result as string); 
            reader.onerror = reject;
            reader.readAsDataURL(file); 
        });
        
        const b64Array = await Promise.all(files.map(readAsDataURL));
        setFileData(JSON.stringify({ isMulti: files.length > 1, data: b64Array }));
    } catch (err) {
        alert("Failed to process file.");
    } finally {
        setIsProcessing(false); e.target.value = '';
    }
  };

  const startAudioRecord = async () => {
      setInputType('audio');
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder.current = new MediaRecorder(stream); audioChunks.current = [];
          mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
          mediaRecorder.current.onstop = async () => {
              const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
              setPreviews([{ type: 'audio', url: URL.createObjectURL(audioBlob), name: 'Live_Audio_Record.webm' }]);
              const reader = new FileReader(); reader.onload = () => setFileData(JSON.stringify({ isMulti: false, data: [reader.result] }));
              reader.readAsDataURL(audioBlob); setVaultName(`AUD_Record_${Math.random().toString(36).substr(2, 4).toUpperCase()}_Vault`);
          };
          mediaRecorder.current.start(); setIsRecording(true);
      } catch (err) { alert("Microphone access denied!"); setInputType('none'); }
  };
  const stopAudioRecord = () => { if(mediaRecorder.current) { mediaRecorder.current.stop(); setIsRecording(false); } };

  const handleEncrypt = () => {
    let finalData = inputType === 'text' ? `TXT_MSG:${textData}` : fileData;
    if(!finalData || !password) return alert("Data & Password required!");
    if(inputType === 'text' && !vaultName) setVaultName(`TXT_SecretMsg_${Math.random().toString(36).substr(2, 4).toUpperCase()}`);
    
    setIsProcessing(true);
    setTimeout(() => {
        try {
            const fileId = "CV_" + Math.random().toString(36).substr(2, 6).toUpperCase();
            const { encryptedData, originalSize, compressedSize, savedRatio } = encryptFile(finalData, password);
            setStats({ originalSize, compressedSize, savedRatio });
            setPuzzles(createPuzzles(encryptedData, fileId, density));
            setSplitCount(1); setTempSplitCount(1); setCurrentPage(1);
        } catch (error) {
            alert("Encryption failed due to memory limits. Try a smaller file.");
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    }, 150);
  };

  const clearSendForm = () => { 
      setInputType('none'); setFileData(''); setTextData(''); setPassword(''); setPuzzles([]); setStats(null); setPreviews([]); 
      setCurrentPage(1); setVaultName(''); setSplitCount(1); 
      localforage.removeItem('cv_draft_vault').catch(()=>{}); // Clear robust storage
  };

  const saveSplitConfig = () => {
      if(tempSplitCount < 1) return alert("❌ Value must be 1 or greater.");
      if(tempSplitCount > puzzles.length) return alert(`❌ Maximum value is ${puzzles.length}.`);
      setSplitCount(tempSplitCount); setIsSplitModalOpen(false);
  };

  const puzzleGroups = splitCount <= 1 ? [puzzles] : Array.from({ length: Math.ceil(puzzles.length / Math.ceil(puzzles.length / splitCount)) }, (v, i) => puzzles.slice(i * Math.ceil(puzzles.length / splitCount), i * Math.ceil(puzzles.length / splitCount) + Math.ceil(puzzles.length / splitCount)));

  const initiateDownload = (group: string[], groupIndex: number, type: 'zip'|'pdf') => setConfirmModal({ active: true, type, groupIndex, group });

  const executeDownload = async () => {
      if(!confirmModal) return;
      const { type, groupIndex, group } = confirmModal;
      setConfirmModal(null);
      setDlProgress({ active: true, current: 0, total: group.length, msg: `Initializing Engine...`, percent: 0, minimized: false });

      let wakeLock: any = null;
      try {
          if ('wakeLock' in navigator) wakeLock = await (navigator as any).wakeLock.request('screen');
          
          const folderName = splitCount > 1 ? `${vaultName}_Part_${groupIndex + 1}` : vaultName;
          const startIndex = splitCount > 1 ? (groupIndex * Math.ceil(puzzles.length / splitCount)) : 0;
          
          const isOnline = navigator.onLine;
          const compileBatchSize = document.hidden ? 200 : (isOnline ? 30 : 10);

          if (type === 'zip') {
              const zip = new JSZip();
              const folder = zip.folder(folderName);
              
              for (let i = 0; i < group.length; i++) {
                  const dataUrl = await QRCode.toDataURL(group[i], { errorCorrectionLevel: qrConfig.level as any, margin: qrConfig.margin, color: { dark: qrConfig.fg, light: qrConfig.bg }});
                  folder?.file(`QR_${startIndex + i + 1}.png`, dataUrl.replace(/^data:image\/png;base64,/, ""), {base64: true});
                  
                  if (i % compileBatchSize === 0) {
                      setDlProgress(prev => ({ ...prev, current: i + 1, msg: `Compiling Secure QRs...`, percent: ((i+1)/group.length)*50 }));
                      await new Promise(r => setTimeout(r, 0)); 
                  }
              }
              
              setDlProgress(prev => ({ ...prev, current: group.length, msg: `Packaging Archive...`, percent: 50 }));
              await new Promise(r => setTimeout(r, 50)); 
              
              const content = await zip.generateAsync(
                  { type:"blob", compression: "STORE" }, 
                  (metadata) => setDlProgress(prev => ({ ...prev, msg: `Finalizing Export: ${metadata.percent.toFixed(0)}%`, percent: 50 + (metadata.percent / 2) }))
              );
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

                  if (i % compileBatchSize === 0) {
                      setDlProgress(prev => ({ ...prev, current: i + 1, msg: `Rendering PDF Grid...`, percent: ((i+1)/group.length)*95 }));
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
              setDlProgress(prev => ({ ...prev, current: group.length, msg: `Saving Document...`, percent: 100 }));
              await new Promise(r => setTimeout(r, 50));
              pdf.save(splitCount > 1 ? `${vaultName}_PrintBundle_${groupIndex + 1}.pdf` : `${vaultName}_PrintBundle.pdf`);
          }
      } catch (err) { alert(`Failed to export data.`); } 
      finally {
          if (wakeLock !== null) wakeLock.release().catch(()=>{});
          setDlProgress({ active: false, current: 0, total: 0, msg: '', percent: 0, minimized: false });
      }
  };

  const currentPuzzles = puzzles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(puzzles.length / itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {confirmModal && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl text-center">
                  <div className="flex justify-center mb-4"><AlertCircle className="w-12 h-12 text-blue-500"/></div>
                  <h3 className="text-xl font-bold mb-2">Confirm Data Export</h3>
                  <p className="text-sm text-gray-500 mb-6">Generating <strong>{confirmModal.group.length} Secured QRs</strong> into a <strong>{confirmModal.type.toUpperCase()}</strong> file format. Runs completely offline.</p>
                  <div className="flex space-x-3">
                      <button onClick={()=>setConfirmModal(null)} className="flex-1 p-3 bg-gray-200 dark:bg-gray-800 rounded-xl font-bold">Cancel</button>
                      <button onClick={executeDownload} className="flex-1 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">Start Export</button>
                  </div>
              </div>
          </div>
      )}

      {dlProgress.active && !dlProgress.minimized && (
          <div className="fixed inset-0 z-[70] bg-gray-50 dark:bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center shadow-2xl">
              <button onClick={() => setDlProgress({...dlProgress, minimized: true})} className="absolute top-6 right-6 p-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full transition-all text-gray-800 dark:text-white"><Minus className="w-6 h-6"/></button>
              
              <div className="relative mb-8 flex justify-center items-center">
                  <div className="absolute inset-0 bg-blue-500 blur-[60px] opacity-30 rounded-full w-32 h-32 m-auto"></div>
                  <div className="relative z-10 p-6 bg-white dark:bg-gray-900 rounded-full shadow-2xl border border-gray-200 dark:border-gray-800 animate-[pulse_2s_infinite]">
                      <Download className="w-12 h-12 text-blue-600 dark:text-blue-400"/>
                  </div>
                  <Zap className="w-8 h-8 text-green-500 absolute -bottom-2 -right-2 animate-bounce z-20 drop-shadow-lg"/>
              </div>

              <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{dlProgress.msg}</h2>
              <p className="text-blue-600 dark:text-blue-400 font-mono text-xl mb-8 tracking-widest font-bold">{dlProgress.current} <span className="text-gray-400 text-sm">/ {dlProgress.total}</span></p>
              
              <div className="w-full max-w-md bg-gray-200 dark:bg-gray-900 rounded-full h-4 overflow-hidden border border-gray-300 dark:border-gray-800 shadow-inner relative">
                  <div className="bg-gradient-to-r from-blue-500 via-green-400 to-emerald-500 h-full transition-all duration-300 relative overflow-hidden" style={{ width: `${dlProgress.percent || 0}%` }}>
                      <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/30 -skew-x-12 translate-x-[-100%] animate-[shimmer_1s_infinite]"></div>
                  </div>
              </div>
              
              <p className="text-gray-500 dark:text-gray-400 text-xs font-bold mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-5 py-3 rounded-full flex items-center shadow-sm">
                  {navigator.onLine ? <><Cloud className="w-4 h-4 mr-2 text-blue-500"/> Cloud-Accelerated Mode Active</> : <><WifiOff className="w-4 h-4 mr-2 text-orange-500"/> Safe Offline Mode Active</>}
              </p>
          </div>
      )}

      {dlProgress.active && dlProgress.minimized && (
          <div onClick={() => setDlProgress({...dlProgress, minimized: false})} className="fixed top-24 right-4 z-[70] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl shadow-2xl cursor-pointer hover:scale-105 flex items-center space-x-4">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin"/>
              <div>
                  <p className="text-xs font-bold text-gray-800 dark:text-white mb-1">Exporting Data...</p>
                  <div className="w-24 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden"><div className="bg-blue-500 h-full transition-all" style={{ width: `${dlProgress.percent || 0}%` }}></div></div>
              </div>
              <Maximize2 className="w-4 h-4 text-gray-500"/>
          </div>
      )}

      {isSplitModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl w-full max-w-sm border border-gray-200 dark:border-gray-800 shadow-2xl">
                  <h3 className="text-xl font-bold mb-2">Configure Bundle Separation</h3>
                  <p className="text-xs text-gray-500 mb-6">How many separate bundles do you want?</p>
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
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Camera className="w-6 h-6 text-blue-500 mb-2"/> <span className="text-xs font-bold text-center">Live Photo</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>handleFileUpload(e, 'image')} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Video className="w-6 h-6 text-red-500 mb-2"/> <span className="text-xs font-bold text-center">Live Video</span><input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>handleFileUpload(e, 'video')} /></label>
              <button onClick={startAudioRecord} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:scale-105 shadow-sm transition-all"><Mic className="w-6 h-6 text-orange-500 mb-2"/> <span className="text-xs font-bold text-center">Live Audio</span></button>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><ImageIcon className="w-6 h-6 text-pink-500 mb-2"/> <span className="text-xs font-bold text-center">Gallery (Max 3)</span><input type="file" accept="image/*, video/*" multiple className="hidden" onChange={(e)=>handleFileUpload(e, 'media')} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><Video className="w-6 h-6 text-purple-500 mb-2"/> <span className="text-xs font-bold text-center">Video File</span><input type="file" accept="video/*" className="hidden" onChange={(e)=>handleFileUpload(e, 'video')} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><FileAudio className="w-6 h-6 text-yellow-500 mb-2"/> <span className="text-xs font-bold text-center">Audio File</span><input type="file" accept="audio/*" className="hidden" onChange={(e)=>handleFileUpload(e, 'audio')} /></label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all"><FileText className="w-6 h-6 text-indigo-500 mb-2"/> <span className="text-xs font-bold text-center">Document</span><input type="file" accept=".pdf,.doc,.docx,.txt,.xls" className="hidden" onChange={(e)=>handleFileUpload(e, 'document')} /></label>
              <button onClick={() => setInputType('text')} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:scale-105 transition-all shadow-sm"><Type className="w-6 h-6 text-green-500 mb-2"/> <span className="text-xs font-bold text-center">Secret Text</span></button>
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
              ) : inputType === 'audio' && isRecording ? (
                  <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50 flex flex-col items-center">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse mb-3"/>
                      <span className="font-bold text-red-600 mb-4">Recording Live Audio...</span>
                      <button onClick={stopAudioRecord} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-full font-bold shadow-md"><StopCircle className="w-5 h-5 mr-2"/> Stop Recording</button>
                  </div>
              ) : (
                  <>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl flex items-center border border-green-200 dark:border-green-800/50">
                        <CheckCircle className="w-5 h-5 mr-2"/> <span className="text-sm font-bold truncate">Data Loaded successfully.</span>
                    </div>
                    {previews.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {previews.map((p, i) => (
                                <div key={i} className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                                    {p.type === 'image' ? <img src={p.url} className="w-full h-full object-cover"/> :
                                     p.type === 'video' ? <Video className="w-8 h-8 text-gray-400 mb-1"/> :
                                     p.type === 'audio' ? <Mic className="w-8 h-8 text-orange-400 mb-1"/> :
                                     <FileText className="w-8 h-8 text-indigo-400 mb-1"/>}
                                    {p.type !== 'image' && <span className="text-[10px] font-bold text-gray-500 truncate w-full text-center px-1">{p.name}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                  </>
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
              <button onClick={handleEncrypt} disabled={isProcessing || (inputType === 'audio' && isRecording) || (!fileData && !textData)} className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black shadow-lg transition-all disabled:opacity-50">
                  {isProcessing ? "Processing Vault..." : "ENCRYPT & GENERATE"}
              </button>
          </div>
      )}

      {puzzles.length > 0 && (
        <div className="space-y-4">
          <div className="bg-gray-100 dark:bg-black p-5 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                  <div>
                      <h3 className="text-xl font-black text-green-600 dark:text-green-500">{vaultName}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{puzzles.length} Total QRs • Saved {stats?.savedRatio}% data</p>
                  </div>
                  <button onClick={clearSendForm} className="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold">Clear</button>
              </div>

              <div className="bg-white dark:bg-gray-800/50 p-3 rounded-xl mb-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center"><Share2 className="w-4 h-4 text-blue-500 dark:text-blue-400 mr-2"/><span className="text-xs font-bold text-gray-700 dark:text-gray-300">Bundle Separation: {splitCount} Groups</span></div>
                  <button onClick={() => { setTempSplitCount(splitCount); setIsSplitModalOpen(true); }} className="p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-white"><Settings2 className="w-4 h-4"/></button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                  {puzzleGroups.map((group, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-2 bg-white dark:bg-gray-800/30 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                          <div className="flex-1 flex items-center justify-between px-2 mb-2 md:mb-0">
                             <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{splitCount > 1 ? `Bundle ${idx + 1}` : 'Full Vault'}</span>
                             <span className="text-xs bg-gray-100 dark:bg-black/40 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-lg">{group.length} QRs</span>
                          </div>
                          <div className="flex gap-2">
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
              <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-30"><ChevronLeft className="w-6 h-6"/></button>
                  <span className="font-bold font-mono text-sm text-gray-700 dark:text-gray-300">Page {currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-30"><ChevronRight className="w-6 h-6"/></button>
              </div>
          )}
        </div>
      )}
    </div>
  );
}
