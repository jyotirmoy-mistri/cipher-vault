"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import localforage from 'localforage';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { Camera, Image as ImageIcon, FileText, X, SwitchCamera, Flashlight, FileArchive } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ScanTab({ isActive }: { isActive: boolean }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  
  // ZIP Status & Cancellation States
  const [zipStatus, setZipStatus] = useState({ active: false, progress: 0, total: 0, msg: '' });
  const abortZipRef = useRef(false);
  const trackedChunksRef = useRef<{id: string, part: number}[]>([]);

  // Other Status
  const [scanStatus, setScanStatus] = useState({ type: '', msg: '' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanningPDF, setIsScanningPDF] = useState(false);

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
      } catch (err) { showStatus('error', "Camera access denied."); }
  };
  
  const stopCamera = async () => {
      if(html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          try { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); } catch(e){}
      }
      setCameraActive(false); setFlashOn(false);
  };

  const toggleFlash = async () => {
      if(!html5QrCodeRef.current || !cameraActive) return;
      try { await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ torch: !flashOn } as any] }); setFlashOn(!flashOn); } 
      catch(e) { showStatus('error', "Flashlight not supported."); }
  };

  // --- SAFE ZIP SCANNER WITH ABORT & ROLLBACK ---
  const handleZIPUpload = async (e: any) => {
      const file = e.target.files[0];
      if(!file || (!file.name.endsWith('.zip') && file.type !== "application/zip")) return showStatus('error', 'Please upload a ZIP file.');
      
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
                  // User Clicked Cancel! Rollback time.
                  setZipStatus({ active: true, progress: i, total: imgFiles.length, msg: 'Cancelling & Rolling Back...' });
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
              } catch(e) {} // Skip invalid
              
              // Yield to let UI update and Cancel button register clicks
              await new Promise(resolve => setTimeout(resolve, 0));
          }
          
          if(foundCount > 0) showStatus('success', `Auto-Extracted & Saved ${foundCount} parts!`);
          else showStatus('error', "No valid QRs found in the ZIP.");
      } catch(e) { showStatus('error', "Failed to read ZIP file."); }
      
      setZipStatus({ active: false, progress: 0, total: 0, msg: '' });
  };

  const cancelZipScan = () => { abortZipRef.current = true; };

  const undoAddedChunks = async () => {
      const history: any = await localforage.getItem('scan_history') || {};
      trackedChunksRef.current.forEach(chunk => {
          if (history[chunk.id] && history[chunk.id].chunks) {
              delete history[chunk.id].chunks[chunk.part];
              // If vault becomes empty, delete the vault
              if (Object.keys(history[chunk.id].chunks).length === 0) {
                  delete history[chunk.id];
              }
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
                 
                 if (fromZip) {
                     trackedChunksRef.current.push({ id: parsed.id, part: parsed.part });
                 } else {
                     showStatus('success', `Saved Part ${parsed.part}/${parsed.total}!`);
                 }
             }
          }
      } catch(e) {}
  };

  const handleImageUpload = async (e: any) => { /* omitted for brevity, same as before */ };
  const handlePDFUpload = async (e: any) => { /* omitted for brevity, same as before */ };

  useEffect(() => { if (!isActive) stopCamera(); }, [isActive]);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {scanStatus.msg && (
          <div className={`p-4 rounded-xl font-bold flex items-center justify-center text-sm shadow-md ${scanStatus.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
              {scanStatus.msg}
          </div>
      )}

      {/* Existing Camera & Hidden Scanner UI... */}
      <div className="flex space-x-2">
          <button onClick={cameraActive ? stopCamera : startCamera} className={`flex-1 p-4 rounded-xl font-black text-white flex justify-center items-center transition-all shadow-md ${cameraActive ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'}`}>
              <Camera className="w-5 h-5 mr-2"/> {cameraActive ? 'Close Camera' : 'Open Camera Scanner'}
          </button>
      </div>
      <div className={`w-full rounded-3xl overflow-hidden bg-black transition-all duration-300 ${cameraActive ? 'min-h-[300px] border-4 border-green-500/30' : 'h-0'}`}>
          <div id="reader" className="w-full border-none"></div>
      </div>
      <div id="hidden-scanner" className="hidden"></div>

      {/* SMART ZIP SCANNER BOX */}
      <div className="bg-blue-600 rounded-2xl shadow-lg overflow-hidden transition-all">
          {!zipStatus.active ? (
              <label className="flex items-center justify-between p-5 hover:bg-blue-500 text-white cursor-pointer transition-all">
                  <div className="flex items-center"><FileArchive className="w-8 h-8 mr-4"/><div><h3 className="font-black text-lg">Auto-Scan ZIP Bundle</h3><p className="text-xs text-blue-200">Upload downloaded ZIP to extract directly</p></div></div>
                  <input type="file" accept=".zip, application/zip" className="hidden" onChange={handleZIPUpload} />
              </label>
          ) : (
              <div className="p-5 bg-gray-900 text-white flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center"><FileArchive className="w-6 h-6 text-blue-400 mr-2"/><span className="font-bold">{zipStatus.msg}</span></div>
                      <button onClick={cancelZipScan} className="p-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold text-white transition-all"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700">
                      <div className="bg-gradient-to-r from-blue-500 to-green-400 h-full transition-all duration-200" style={{ width: `${(zipStatus.progress / zipStatus.total) * 100 || 0}%` }}></div>
                  </div>
              </div>
          )}
      </div>

      <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-800"></div></div><div className="relative flex justify-center"><span className="bg-gray-50 dark:bg-gray-950 px-4 text-xs font-bold text-gray-500 uppercase">Or Scan Individual</span></div></div>

      {/* PDF & IMG Scanners... (same as previous) */}
    </div>
  );
}
