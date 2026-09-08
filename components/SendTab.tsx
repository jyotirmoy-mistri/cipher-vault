"use client";
import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { encryptFile, createPuzzles } from '../utils/vaultLogic';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Camera, Image as ImageIcon, FileText, Type, CheckCircle, Share2, Printer, X, Video, FileAudio, Download } from 'lucide-react';

export default function SendTab({ qrConfig }: { qrConfig: any }) {
  const [inputType, setInputType] = useState<'none' | 'file' | 'text'>('none');
  const [fileData, setFileData] = useState<string>('');
  const [textData, setTextData] = useState<string>('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [puzzles, setPuzzles] = useState<string[]>([]);
  const [isGridOpen, setIsGridOpen] = useState(true);
  const [splitCount, setSplitCount] = useState(1);
  const gridRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if(!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => { setFileData(event.target?.result as string); setIsProcessing(false); };
    reader.readAsDataURL(file);
  };

  const handleEncrypt = () => {
    const dataToEncrypt = inputType === 'text' ? textData : fileData;
    if(!dataToEncrypt || !password) return alert("Data & Password required!");
    setIsProcessing(true);
    setTimeout(() => {
        const fileId = "CV_" + Math.random().toString(36).substr(2, 6).toUpperCase();
        const finalData = inputType === 'text' ? `TXT_MSG:${dataToEncrypt}` : dataToEncrypt;
        const encrypted = encryptFile(finalData, password);
        setPuzzles(createPuzzles(encrypted, fileId));
        setIsGridOpen(true);
        setIsProcessing(false);
    }, 500);
  };

  const clearSendForm = () => { setInputType('none'); setFileData(''); setTextData(''); setPassword(''); setPuzzles([]); setSplitCount(1); };

  const puzzleGroups = splitCount <= 1 ? [puzzles] : Array.from({ length: Math.ceil(puzzles.length / Math.ceil(puzzles.length / splitCount)) }, (v, i) => puzzles.slice(i * Math.ceil(puzzles.length / splitCount), i * Math.ceil(puzzles.length / splitCount) + Math.ceil(puzzles.length / splitCount)));

  const handleDownload = async (index: number, format: 'pdf' | 'png') => {
      if(!window.confirm(`Are you sure you want to download Part ${index + 1} as ${format.toUpperCase()}?`)) return;
      const el = gridRefs.current[index];
      if(!el) return;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: qrConfig.bg });
      if(format === 'png') {
          const link = document.createElement('a'); link.download = `CipherVault_Part_${index + 1}.png`;
          link.href = canvas.toDataURL('image/png'); link.click();
      } else {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
          pdf.save(`CipherVault_Part_${index + 1}.pdf`);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {inputType === 'none' && (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all">
                  <Camera className="w-6 h-6 text-blue-500 mb-2"/> <span className="text-xs font-bold text-center">Live Photo</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all">
                  <Video className="w-6 h-6 text-red-500 mb-2"/> <span className="text-xs font-bold text-center">Live Video (360p)</span>
                  <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all">
                  <ImageIcon className="w-6 h-6 text-pink-500 mb-2"/> <span className="text-xs font-bold text-center">Gallery Image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all">
                  <Video className="w-6 h-6 text-purple-500 mb-2"/> <span className="text-xs font-bold text-center">Gallery Video</span>
                  <input type="file" accept="video/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all">
                  <FileAudio className="w-6 h-6 text-yellow-500 mb-2"/> <span className="text-xs font-bold text-center">Audio</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 transition-all">
                  <FileText className="w-6 h-6 text-orange-500 mb-2"/> <span className="text-xs font-bold text-center">Document</span>
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(e)=>{setInputType('file'); handleFileUpload(e);}} />
              </label>
              <button onClick={() => setInputType('text')} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:scale-105 transition-all col-span-3 md:col-span-2">
                  <Type className="w-6 h-6 text-green-500 mb-2"/> <span className="text-xs font-bold">Secret Text Message</span>
              </button>
          </div>
      )}

      {inputType !== 'none' && puzzles.length === 0 && (
          <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold">Encrypt Data</h3>
                  <button onClick={clearSendForm} className="text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded-xl"><X className="w-5 h-5"/></button>
              </div>
              {inputType === 'text' ? (
                  <textarea placeholder="Type secret message..." value={textData} onChange={(e)=>setTextData(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800 h-32" />
              ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-xl flex items-center border border-gray-200 dark:border-gray-800">
                      {fileData ? <CheckCircle className="text-green-500 mr-2"/> : <div className="w-5 h-5 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin mr-2"/>}
                      <span className="text-sm truncate">{fileData ? "File Encrypted & Ready" : "Waiting for file..."}</span>
                  </div>
              )}
              <input type="password" placeholder="Vault Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800" />
              <button onClick={handleEncrypt} disabled={isProcessing} className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all">
                  {isProcessing ? "Processing..." : "Generate Vault"}
              </button>
          </div>
      )}

      {puzzles.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Generated Vault ({puzzles.length} QRs)</h3>
              <div className="flex space-x-2">
                  <button onClick={() => setIsGridOpen(!isGridOpen)} className="px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg text-sm font-bold">{isGridOpen ? 'Fold' : 'Unfold'}</button>
                  <button onClick={clearSendForm} className="px-3 py-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold">Clear Form</button>
              </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center">
                  <Share2 className="w-5 h-5 text-blue-500 mr-2"/>
                  <div><p className="text-sm font-bold">Fragment Split Share</p><p className="text-xs text-gray-500">Divide QRs into multiple files</p></div>
              </div>
              <input type="number" min="1" max={puzzles.length} value={splitCount} onChange={(e)=>setSplitCount(Number(e.target.value) || 1)} className="w-16 p-2 text-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg outline-none" />
          </div>
          
          {isGridOpen && puzzleGroups.map((group, gIdx) => (
              <div key={gIdx} className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-gray-700 dark:text-gray-300">{puzzleGroups.length > 1 ? `Part ${gIdx + 1} (${group.length} QRs)` : 'Full Vault'}</h4>
                      <div className="flex space-x-2">
                         <button onClick={() => handleDownload(gIdx, 'png')} className="flex items-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold"><Download className="w-3 h-3 mr-1"/> PNG</button>
                         <button onClick={() => handleDownload(gIdx, 'pdf')} className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"><Download className="w-3 h-3 mr-1"/> PDF</button>
                      </div>
                  </div>
                  <div ref={el => { gridRefs.current[gIdx] = el }} className="grid grid-cols-2 gap-4 p-4 rounded-xl" style={{ backgroundColor: qrConfig.bg }}>
                      {group.map((pzl, idx) => (
                          <div key={idx} className="flex flex-col items-center">
                              <QRCodeSVG value={pzl} size={120} fgColor={qrConfig.fg} bgColor={qrConfig.bg} level="M" />
                              <p className="text-xs mt-2 font-mono font-bold" style={{ color: qrConfig.fg }}>{puzzles.indexOf(pzl) + 1}/{puzzles.length}</p>
                          </div>
                      ))}
                  </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
