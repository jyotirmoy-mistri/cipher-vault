"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import localforage from 'localforage';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { Camera, Image as ImageIcon, FileText, X, SwitchCamera, Flashlight, FileArchive, UploadCloud } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ScanTab({ isActive }: { isActive: boolean }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  
  const [zipStatus, setZipStatus] = useState({ active: false, progress: 0, total: 0, msg: '' });
  const abortZipRef = useRef(false);
  const trackedChunksRef = useRef<{id: string, part: number}[]>([]);

  const [scanStatus, setScanStatus] = useState({ type: '', msg: '' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);

  const showStatus = (type: 'error' | 'success' | 'loading', msg: string) => { 
      setScanStatus({ type, msg }); 
      if(type !== 'loading') setTimeout(() => setScanStatus({ type: '', msg: '' }), 4000); 
  };

  const startCamera = async () => {
      if(cameraActive) await stopCamera();
      html5QrCodeRef.current = new Html5Qrcode("reader");
      try {
          await html5QrCodeRef.current.start({ facingMode: facingMode }, { fps: 15, qrbox: 250 }, processScannedData, undefined);
          setCameraActive(true);
      } catch (error) { 
          console.error(error); 
          showStatus('error', "Camera access denied or device missing."); 
      }
  };
  
  const stopCamera = async () => {
      if(html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          try { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); } catch(error){ console.error(error); }
      }
      setCameraActive(false); setFlashOn(false);
  };

  const toggleFlash = async () => {
      if(!html5QrCodeRef.current || !cameraActive) return;
      try { await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ torch: !flashOn } as any] }); setFlashOn(!flashOn); } 
      catch(error) { console.error(error); showStatus('error', "Flashlight not supported."); }
  };

  const processFileSelection = async (file: File) => {
      if(!file) return;
      if (file.name.endsWith('.zip') || file.type === "application/zip") {
          await processZIPFile(file);
      } else if (file.type === "application/pdf") {
          await processPDFFile(file);
      } else if (file.type.startsWith("image/")) {
          await processImageFile(file);
      } else {
          showStatus('error', 'Unsupported file type. Upload ZIP, PDF, or Image.');
      }
  };

  const processZIPFile = async (file: File) => {
      abortZipRef.current = false;
      trackedChunksRef.current = [];
      setZipStatus({ active: true, progress: 0, total: 0, msg: 'Loading ZIP...' });
      
      try {
          const zip = new JSZip();
          const loadedZip = await zip.loadAsync(file);
          const imgFiles = Object.values(loadedZip.files).filter(f => !f.dir && /\.(png|jpe?g)$/i.test(f.name));
          
          if(imgFiles.length === 0) { setZipStatus({ active: false, progress: 0, total: 0, msg: '' }); return showStatus('error', 'No images found in ZIP.'); }

          setZipStatus({ active: true, progress: 0, total: imgFiles.length, msg: 'Extracting...' });
          const scanner = new Html5Qrcode("hidden-scanner");
          let foundCount = 0;

          for (let i = 0; i < imgFiles.length; i++) {
              if (abortZipRef.current) {
                  setZipStatus({ active: true, progress: i, total: imgFiles.length, msg: 'Rolling Back...' });
                  await undoAddedChunks();
                  setZipStatus({ active: false, progress: 0, total: 0, msg: '' });
                  return showStatus('error', 'ZIP Scan Aborted. Data cleared.');
              }

              setZipStatus({ active: true, progress: i + 1, total: imgFiles.length, msg: `Scanning QR ${i + 1}/${imgFiles.length}` });
              const blob = await imgFiles[i].async("blob");
              const tempFile = new File([blob], "temp.png", { type: "image/png" });
              
              try {
                  const decoded = await scanner.scanFile(tempFile, true);
                  await processScannedData(decoded, true);
                  foundCount++;
              } catch(error) { console.error(error); } 
              
              await new Promise(resolve => setTimeout(resolve, 0));
          }
          
          if(foundCount > 0) showStatus('success', `Extracted & Saved ${foundCount} parts!`);
          else showStatus('error', "No valid QRs found in the ZIP.");
      } catch(error) { console.error(error); showStatus('error', "Failed to read ZIP file."); }
      
      setZipStatus({ active: false, progress: 0, total: 0, msg: '' });
  };

  const processPDFFile = async (file: File) => {
      setIsScanningActive(true);
      try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const scanner = new Html5Qrcode("hidden-scanner");
          let foundCount = 0;

          for (let i = 1; i <= pdf.numPages; i++) {
              showStatus('loading', `Scanning PDF Page ${i}/${pdf.numPages}...`);
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2.5 }); 
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = viewport.width; canvas.height = viewport.height;
              
              if(ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
              await page.render({ canvasContext: ctx!, viewport }).promise;
              if(i === 1) setPreviewUrl(canvas.toDataURL());

              try {
                  const decoded = await scanner.scanFile(canvas as any, true);
                  await processScannedData(decoded);
                  foundCount++;
              } catch(error) { console.error(error); } 
          }
          if(foundCount > 0) showStatus('success', `Found ${foundCount} parts in PDF!`);
          else showStatus('error', "No QRs found in PDF.");
      } catch(error) { console.error(error); showStatus('error', "Failed to read PDF."); }
      setIsScanningActive(false);
  };

  const processImageFile = async (file: File) => {
      setPreviewUrl(URL.createObjectURL(file));
      showStatus('loading', 'Scanning Image...');
      if(!html5QrCodeRef.current) html5QrCodeRef.current = new Html5Qrcode("reader");
      try {
          const decoded = await html5QrCodeRef.current.scanFile(file, true);
          await processScannedData(decoded);
          showStatus('success', 'Image Scanned Successfully!');
      } catch(error) { console.error(error); showStatus('error', "No valid QR found in image."); }
  };

  const undoAddedChunks = async () => {
      const history: any = await localforage.getItem('scan_history') || {};
      trackedChunksRef.current.forEach(chunk => {
          if (history[chunk.id] && history[chunk.id].chunks) {
              delete history[chunk.id].chunks[chunk.part];
              if (Object.keys(history[chunk.id].chunks).length === 0) delete history[chunk.id];
          }
      });
      await localforage.setItem('scan_history', history);
  };

  const processScannedData = async (decodedText: string, fromZip = false) => {
      try {
          const parsed = JSON.parse(decodedText);
          if(parsed.cv_sig === "CipherVault_v2" && parsed.id) {
             const history: any = await localforage.getItem('scan_history') || {};
             if(!history[parsed.id]) history[parsed.id] = { total: parsed.total, chunks: {} };
             
             if(!history[parsed.id].chunks[parsed.part]) {
                 history[parsed.id].chunks[parsed.part] = parsed.data;
                 await localforage.setItem('scan_history', history);
                 
                 if (fromZip) trackedChunksRef.current.push({ id: parsed.id, part: parsed.part });
                 else showStatus('success', `Saved Part ${parsed.part}/${parsed.total}!`);
             }
          }
      } catch(error) { console.error(error); }
  };

  useEffect(() => { if (!isActive) stopCamera(); }, [isActive]);

  return (
    <div 
        className={`space-y-6 animate-in fade-in pb-10 transition-all ${isDragging ? 'scale-[0.98] opacity-80' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) processFileSelection(e.dataTransfer.files[0]); }}
    >
      {isDragging && (
          <div className="absolute inset-0 z-50 bg-blue-600/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center text-white border-4 border-dashed border-white m-4 pointer-events-none">
              <UploadCloud className="w-20 h-20 mb-4 animate-bounce"/>
              <h2 className="text-3xl font-black">Drop File to Scan!</h2>
              <p className="font-bold text-blue-200">ZIP, PDF, or Image supported</p>
          </div>
      )}

      {scanStatus.msg && (
          <div className={`p-4 rounded-xl font-bold flex items-center justify-center text-sm shadow-md ${scanStatus.type === 'error' ? 'bg-red-100 text-red-600 border border-red-200' : scanStatus.type === 'loading' ? 'bg-blue-100 text-blue-600 border border-blue-200 animate-pulse' : 'bg-green-100 text-green-700 border border-green-200'}`}>
              {scanStatus.msg}
          </div>
      )}

      <div className="flex space-x-2">
          <button onClick={cameraActive ? stopCamera : startCamera} className={`flex-1 p-4 rounded-xl font-black text-white flex justify-center items-center transition-all shadow-md ${cameraActive ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'}`}>
              <Camera className="w-5 h-5 mr-2"/> {cameraActive ? 'Close Camera' : 'Open Camera Scanner'}
          </button>
          {cameraActive && (
              <>
                  <button onClick={() => { stopCamera(); setFacingMode(prev => prev === 'environment' ? 'user' : 'environment'); setTimeout(startCamera, 500); }} className="p-4 bg-gray-200 dark:bg-gray-800 rounded-xl shadow-sm"><SwitchCamera className="w-6 h-6"/></button>
                  <button onClick={toggleFlash} className={`p-4 rounded-xl shadow-sm ${flashOn ? 'bg-yellow-400 text-black' : 'bg-gray-200 dark:bg-gray-800'}`}><Flashlight className="w-6 h-6"/></button>
              </>
          )}
      </div>

      <div className={`w-full rounded-3xl overflow-hidden bg-black transition-all duration-300 ${cameraActive ? 'min-h-[300px] border-4 border-green-500/30' : 'h-0'}`}>
          <div id="reader" className="w-full border-none"></div>
      </div>
      <div id="hidden-scanner" className="hidden"></div>

      <div className="bg-blue-600 rounded-2xl shadow-lg overflow-hidden transition-all">
          {!zipStatus.active ? (
              <label className="flex items-center justify-between p-5 hover:bg-blue-500 text-white cursor-pointer transition-all">
                  <div className="flex items-center"><FileArchive className="w-8 h-8 mr-4"/><div><h3 className="font-black text-lg">Auto-Scan ZIP Bundle</h3><p className="text-xs text-blue-200">Upload downloaded ZIP to extract directly</p></div></div>
                  <input type="file" accept=".zip, application/zip" className="hidden" onChange={(e) => processFileSelection(e.target.files![0])} />
              </label>
          ) : (
              <div className="p-5 bg-gray-900 text-white flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center"><FileArchive className="w-6 h-6 text-blue-400 mr-2"/><span className="font-bold">{zipStatus.msg}</span></div>
                      <button onClick={() => abortZipRef.current = true} className="p-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white transition-all"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700">
                      <div className="bg-gradient-to-r from-blue-500 to-green-400 h-full transition-all duration-200" style={{ width: `${(zipStatus.progress / zipStatus.total) * 100 || 0}%` }}></div>
                  </div>
              </div>
          )}
      </div>

      <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-800"></div></div><div className="relative flex justify-center"><span className="bg-gray-50 dark:bg-gray-950 px-4 text-xs font-bold text-gray-500 uppercase">Or Scan Individual</span></div></div>

      <div className="grid grid-cols-2 gap-4">
          <label className={`flex flex-col items-center p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all ${isScanningActive ? 'opacity-50 pointer-events-none' : ''}`}>
              <ImageIcon className="w-8 h-8 text-pink-500 mb-2"/> <span className="text-sm font-bold text-center">Scan Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => processFileSelection(e.target.files![0])} />
          </label>
          <label className={`flex flex-col items-center p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:scale-105 shadow-sm transition-all ${isScanningActive ? 'opacity-50 pointer-events-none' : ''}`}>
              <FileText className="w-8 h-8 text-orange-500 mb-2"/> <span className="text-sm font-bold text-center">Scan PDF</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => processFileSelection(e.target.files![0])} />
          </label>
      </div>

      {previewUrl && (
          <div className="relative p-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm animate-in fade-in">
              <button onClick={()=>setPreviewUrl(null)} className="absolute top-4 right-4 bg-gray-900/70 hover:bg-gray-900 text-white p-2 rounded-full transition-all"><X className="w-5 h-5"/></button>
              <img src={previewUrl} className="w-full h-48 object-contain rounded-xl bg-gray-100 dark:bg-gray-800" />
              <p className="text-center text-xs font-bold text-gray-500 mt-2 tracking-wider uppercase">File Preview</p>
          </div>
      )}
    </div>
  );
}
