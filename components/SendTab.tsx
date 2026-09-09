"use client";
import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { encryptFile, createPuzzles, formatBytes } from '../utils/vaultLogic';
import { Camera, Image as ImageIcon, FileText, Type, CheckCircle, X, Video, FileAudio, Download, TrendingDown, Layers, Shield, FileArchive, Share2, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';

export default function SendTab({ qrConfig }: { qrConfig: any }) {
  const [inputType, setInputType] = useState<'none' | 'file' | 'text' | 'audio'>('none');
  const [fileData, setFileData] = useState<string>('');
  const [textData, setTextData] = useState<string>('');
  const [password, setPassword] = useState('');
  const [density, setDensity] = useState('medium');
  const [vaultName, setVaultName] = useState('Secret_Vault');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [puzzles, setPuzzles] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [splitCount, setSplitCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; 

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if(!file) return;
    
    // Auto-generate Smart Name
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
        
        // Smart Grouping Suggestion
        if (generatedPuzzles.length > 20) setSplitCount(Math.ceil(generatedPuzzles.length / 20)); // Group every 20 QRs
        else if (generatedPuzzles.length > 10) setSplitCount(2);
        else setSplitCount(1);

        setCurrentPage(1);
        setIsProcessing(false);
    }, 150);
  };

  const clearSendForm = () => { 
      setInputType('none'); setFileData(''); setTextData(''); 
      setPassword(''); setPuzzles([]); setStats(null); 
      setCurrentPage(1); setVaultName('Secret_Vault');
  };

  // Grouped ZIP Export Logic
  const puzzleGroups = splitCount <= 1 ? [puzzles] : Array.from({ length: Math.ceil(puzzles.length / Math.ceil(puzzles.length / splitCount)) }, (v, i) => puzzles.slice(i * Math.ceil(puzzles.length / splitCount), i * Math.ceil(puzzles.length / splitCount) + Math.ceil(puzzles.length / splitCount)));

  const downloadZipGroup = async (group: string[], groupIndex: number) => {
      setIsProcessing(true);
      try {
          const zip = new JSZip();
          const folderName = splitCount > 1 ? `${vaultName}_Part_${groupIndex + 1}` : vaultName;
          const folder = zip.folder(folderName);
          
          const startIndex = splitCount > 1 ? (groupIndex * Math.ceil(puzzles.length / splitCount)) : 0;

          for (let i = 0; i < group.length; i++) {
              const dataUrl = await QRCode.toDataURL(group[i], {
                  errorCorrectionLevel: qrConfig.level as any, margin: 2,
                  color: { dark: qrConfig.fg, light: qrConfig.bg }
              });
              const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
              folder?.file(`QR_${startIndex + i + 1}.png`, base64Data, {base64: true});
          }
          
          const content = await zip.generateAsync({type:"blob"});
          saveAs(content, `${folderName}.zip`);
      } catch (err) { alert("Failed to create ZIP."); }
      setIsProcessing(false);
  };

  const currentPuzzles = puzzles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(puzzles.length / itemsPerPage);

  return (
    <div className="space-y-6 animate-in fade-in">
      {inputType === 'none' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all shadow-sm">
                  <Camera className="w-6 h-6 text-blue-500 mb-2"/> <span className="text-xs font-bold text-center">Live Photo</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all shadow-sm">
                  <Video className="w-6 h-6 text-red-500 mb-2"/> <span className="text-xs font-bold text-center">Live Video</span>
                  <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all shadow-sm">
                  <ImageIcon className="w-6 h-6 text-pink-500 mb-2"/> <span className="text-xs font-bold text-center">Image File</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all shadow-sm">
                  <Video className="w-6 h-6 text-purple-500 mb-2"/> <span className="text-xs font-bold text-center">Video File</span>
                  <input type="file" accept="video/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all shadow-sm">
                  <FileAudio className="w-6 h-6 text-yellow-500 mb-2"/> <span className="text-xs font-bold text-center">Audio File</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all shadow-sm">
                  <FileText className="w-6 h-6 text-orange-500 mb-2"/> <span className="text-xs font-bold text-center">Document</span>
                  <input type="file" accept=".pdf,.doc,.docx,.txt,.xls" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <button onClick={() => setInputType('text')} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:scale-105 transition-all col-span-2 shadow-sm">
                  <Type className="w-6 h-6 text-green-500 mb-2"/> <span className="text-xs font-bold">Secret Text Message</span>
              </button>
          </div>
      )}

      {inputType !== 'none' && puzzles.length === 0 && (
          <div className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold flex items-center"><Shield className="w-5 h-5 mr-2 text-green-500"/> Vault Settings</h3>
                  <button onClick={clearSendForm} className="text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded-xl"><X className="w-5 h-5"/></button>
              </div>

              {/* Smart Name Editor */}
              <div className="bg-gray-50 dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center">
                  <Edit3 className="w-5 h-5 text-blue-500 mr-2"/>
                  <input type="text" value={vaultName} onChange={(e)=>setVaultName(e.target.value)} className="w-full bg-transparent outline-none font-bold text-blue-600 dark:text-blue-400" placeholder="Enter Vault Name" />
              </div>
              
              {inputType === 'text' ? (
                  <textarea placeholder="Type secret message..." value={textData} onChange={(e)=>setTextData(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800 h-32" />
              ) : (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl flex items-center border border-green-200 dark:border-green-800/50">
                      <CheckCircle className="w-5 h-5 mr-2"/>
                      <span className="text-sm font-bold truncate">Data Loaded successfully.</span>
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
                  <div className="flex items-center"><Share2 className="w-4 h-4 text-blue-400 mr-2"/><span className="text-xs font-bold text-gray-300">Split into Groups:</span></div>
                  <input type="number" min="1" max={puzzles.length} value={splitCount} onChange={(e)=>setSplitCount(Number(e.target.value) || 1)} className="w-12 bg-gray-900 border border-gray-600 rounded text-center text-sm font-bold text-white outline-none" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                  {puzzleGroups.map((group, idx) => (
                      <button key={idx} onClick={() => downloadZipGroup(group, idx)} disabled={isProcessing} className="flex justify-between items-center p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                          <span className="flex items-center"><FileArchive className="w-4 h-4 mr-2"/> {splitCount > 1 ? `Part ${idx + 1}` : 'Download Full ZIP'}</span>
                          <span className="text-xs bg-black/20 px-2 py-1 rounded-lg">{group.length} QRs</span>
                      </button>
                  ))}
              </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
              {currentPuzzles.map((pzl, idx) => {
                  const actualIndex = (currentPage - 1) * itemsPerPage + idx;
                  return (
                      <div key={actualIndex} className="flex flex-col items-center p-3 border border-gray-100 dark:border-gray-800 rounded-xl" style={{ backgroundColor: qrConfig.bg }}>
                          <QRCodeSVG value={pzl} size={140} fgColor={qrConfig.fg} bgColor={qrConfig.bg} level={qrConfig.level} />
                          <p className="text-xs mt-2 font-mono font-bold" style={{ color: qrConfig.fg }}>{actualIndex + 1}/{puzzles.length}</p>
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
