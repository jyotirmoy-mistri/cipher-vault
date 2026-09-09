"use client";
import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { encryptFile, createPuzzles, formatBytes } from '../utils/vaultLogic';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Camera, Image as ImageIcon, FileText, Type, Share2, X, Video, Mic, StopCircle, ChevronDown, Check } from 'lucide-react';

export default function SendTab({ qrConfig }: { qrConfig: any }) {
  const [inputType, setInputType] = useState<'none' | 'file' | 'text' | 'audio'>('none');
  const [fileData, setFileData] = useState<string>(''); // Base64
  const [previews, setPreviews] = useState<{type: string, url: string, name: string}[]>([]);
  const [textData, setTextData] = useState('');
  const [password, setPassword] = useState('');
  
  // Custom Dropdown State
  const [density, setDensity] = useState('medium');
  const [isDensityOpen, setIsDensityOpen] = useState(false);
  const densityOptions = [
      { id: 'low', label: 'Low Density', sub: 'Many QRs, Easy to Scan' },
      { id: 'medium', label: 'Medium Density', sub: 'Balanced Size & Count' },
      { id: 'high', label: 'High Density', sub: 'Fewer QRs, Needs clear print' }
  ];
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [puzzles, setPuzzles] = useState<string[]>([]);
  const gridRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleFileUpload = async (e: any, type: string) => {
    const files = Array.from(e.target.files).slice(0, 3) as File[]; // Max 3 files
    if(files.length === 0) return;
    setInputType('file');
    setIsProcessing(true);

    const newPreviews = files.map(f => ({
        type: f.type.split('/')[0],
        url: URL.createObjectURL(f),
        name: f.name
    }));
    setPreviews(newPreviews);

    const readAsDataURL = (file: File) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
    });

    const b64Array = await Promise.all(files.map(readAsDataURL));
    setFileData(JSON.stringify({ isMulti: files.length > 1, type: type, data: b64Array }));
    setIsProcessing(false);
  };

  const startAudioRecord = async () => {
      setInputType('audio');
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder.current = new MediaRecorder(stream);
          audioChunks.current = [];
          mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
          mediaRecorder.current.onstop = async () => {
              const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
              const url = URL.createObjectURL(audioBlob);
              setPreviews([{ type: 'audio', url, name: 'Live_Audio_Record.webm' }]);
              const reader = new FileReader();
              reader.onload = () => setFileData(JSON.stringify({ isMulti: false, type: 'audio', data: [reader.result] }));
              reader.readAsDataURL(audioBlob);
          };
          mediaRecorder.current.start();
          setIsRecording(true);
      } catch (err) { alert("Microphone access denied!"); }
  };

  const stopAudioRecord = () => {
      if(mediaRecorder.current) {
          mediaRecorder.current.stop();
          setIsRecording(false);
      }
  };

  const handleEncrypt = () => {
    let finalData = '';
    if(inputType === 'text') finalData = `TXT_MSG:${textData}`;
    else finalData = fileData;

    if(!finalData || !password) return alert("Data & Password required!");
    setIsProcessing(true);
    setTimeout(() => {
        const fileId = "CV_" + Math.random().toString(36).substr(2, 6).toUpperCase();
        const { encryptedData } = encryptFile(finalData, password);
        setPuzzles(createPuzzles(encryptedData, fileId, density));
        setIsProcessing(false);
    }, 100);
  };

  const clearForm = () => { 
      setInputType('none'); setFileData(''); setTextData(''); 
      setPassword(''); setPuzzles([]); setPreviews([]); 
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {inputType === 'none' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all">
                  <Camera className="w-6 h-6 text-blue-500 mb-2"/> <span className="text-xs font-bold text-center">Live Photo</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>handleFileUpload(e, 'image')} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all">
                  <Video className="w-6 h-6 text-red-500 mb-2"/> <span className="text-xs font-bold text-center">Live Video</span>
                  <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e)=>handleFileUpload(e, 'video')} />
              </label>
              <button onClick={startAudioRecord} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all">
                  <Mic className="w-6 h-6 text-orange-500 mb-2"/> <span className="text-xs font-bold text-center">Live Audio</span>
              </button>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all">
                  <ImageIcon className="w-6 h-6 text-pink-500 mb-2"/> <span className="text-xs font-bold text-center">Gallery (Max 3)</span>
                  <input type="file" accept="image/*, video/*" multiple className="hidden" onChange={(e)=>handleFileUpload(e, 'media')} />
              </label>
              <label className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all">
                  <FileText className="w-6 h-6 text-indigo-500 mb-2"/> <span className="text-xs font-bold text-center">Document</span>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e)=>handleFileUpload(e, 'document')} />
              </label>
              <button onClick={() => setInputType('text')} className="flex flex-col items-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm transition-all">
                  <Type className="w-6 h-6 text-green-500 mb-2"/> <span className="text-xs font-bold text-center">Secret Text</span>
              </button>
          </div>
      )}

      {inputType !== 'none' && puzzles.length === 0 && (
          <div className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold">Encrypt Data</h3>
                  <button onClick={clearForm} className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full hover:bg-red-200 transition-colors"><X className="w-4 h-4"/></button>
              </div>
              
              {/* Preview Area */}
              {inputType === 'text' && (
                  <textarea placeholder="Type secret message..." value={textData} onChange={(e)=>setTextData(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800 h-32" />
              )}
              {inputType === 'audio' && isRecording && (
                  <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50 flex flex-col items-center">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse mb-3"/>
                      <span className="font-bold text-red-600 mb-4">Recording Audio...</span>
                      <button onClick={stopAudioRecord} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-full"><StopCircle className="w-5 h-5 mr-2"/> Stop</button>
                  </div>
              )}
              {previews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                      {previews.map((p, i) => (
                          <div key={i} className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                              {p.type === 'image' && <img src={p.url} className="w-full h-full object-cover"/>}
                              {p.type === 'video' && <Video className="w-8 h-8 text-gray-400"/>}
                              {p.type === 'audio' && <Mic className="w-8 h-8 text-gray-400"/>}
                              {p.type === 'application' && <FileText className="w-8 h-8 text-gray-400"/>}
                          </div>
                      ))}
                  </div>
              )}

              {/* Custom Density Dropdown */}
              <div className="relative">
                  <label className="text-xs text-gray-500 font-bold mb-1 block">QR Density Level</label>
                  <button onClick={() => setIsDensityOpen(!isDensityOpen)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center text-left">
                      <div>
                          <p className="font-bold">{densityOptions.find(o => o.id === density)?.label}</p>
                          <p className="text-xs text-gray-500">{densityOptions.find(o => o.id === density)?.sub}</p>
                      </div>
                      <ChevronDown className="w-5 h-5 text-gray-400"/>
                  </button>
                  {isDensityOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                          {densityOptions.map(opt => (
                              <button key={opt.id} onClick={() => {setDensity(opt.id); setIsDensityOpen(false);}} className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                  <div><p className="font-bold">{opt.label}</p><p className="text-xs text-gray-500">{opt.sub}</p></div>
                                  {density === opt.id && <Check className="w-5 h-5 text-green-500"/>}
                              </button>
                          ))}
                      </div>
                  )}
              </div>

              <input type="password" placeholder="Vault Password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-200 dark:border-gray-800" />
              <button onClick={handleEncrypt} disabled={isProcessing || isRecording || !fileData && !textData} className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all disabled:opacity-50">
                  {isProcessing ? "Processing..." : "Generate Vault"}
              </button>
          </div>
      )}

      {puzzles.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-green-100 dark:bg-green-900/30 p-4 rounded-xl border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-green-700 dark:text-green-400">{puzzles.length} Vault QRs Ready</h3>
              <button onClick={clearForm} className="px-3 py-1 bg-white dark:bg-gray-800 text-red-500 rounded-lg text-xs font-bold shadow-sm">Clear All</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
              {puzzles.map((pzl, idx) => (
                  <div ref={el => { gridRefs.current[idx] = el }} key={idx} className="bg-white dark:bg-gray-900 p-4 rounded-2xl flex flex-col items-center border border-gray-200 dark:border-gray-800">
                      <QRCodeSVG value={pzl} size={120} fgColor={qrConfig.fg} bgColor={qrConfig.bg} level={qrConfig.level} />
                      <p className="text-xs mt-2 font-mono" style={{ color: qrConfig.fg }}>Part {idx + 1}/{puzzles.length}</p>
                  </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
