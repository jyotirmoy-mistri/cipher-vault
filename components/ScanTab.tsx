"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import localforage from 'localforage';
import * as pdfjsLib from 'pdfjs-dist';
import { Camera, FileText, X, Flashlight, SwitchCamera, Image as ImageIcon } from 'lucide-react';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ScanTab({ isActive }: { isActive: boolean }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [flashOn, setFlashOn] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scanWarning, setScanWarning] = useState('');
  const [scanSuccessMsg, setScanSuccessMsg] = useState('');
  const [scanFile, setScanFile] = useState<File | null>(null);

  const showWarning = (msg: string) => { setScanWarning(msg); setTimeout(() => setScanWarning(''), 3500); };
  const showSuccess = (msg: string) => { setScanSuccessMsg(msg); setTimeout(() => setScanSuccessMsg(''), 2500); };

  const startCamera = async () => {
      if(cameraActive) await stopCamera();
      html5QrCodeRef.current = new Html5Qrcode("reader");
      try {
          await html5QrCodeRef.current.start(
              { facingMode: facingMode }, { fps: 15, qrbox: { width: 250, height: 250 } },
              processScannedData, undefined
          );
          setCameraActive(true);
      } catch (err) { showWarning("⚠️ Camera access denied or currently in use."); }
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
      catch(e) { showWarning("⚠️ Flashlight not supported."); }
  };

  const handleScanFileUpload = async (e: any) => {
      const file = e.target.files[0];
      if(!file) return;
      setScanFile(file);
      
      if (file.type === "application/pdf") {
          // PDF Parsing Logic
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const scanner = new Html5Qrcode("hidden-scanner");
          let foundCount = 0;
          for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 2.0 });
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = viewport.width; canvas.height = viewport.height;
              await page.render({ canvasContext: ctx!, viewport }).promise;
              try {
                  const decoded = await scanner.scanFile(canvas as any, true);
                  await processScannedData(decoded);
                  foundCount++;
              } catch(e) {} // Ignore pages with no QR
          }
          if(foundCount === 0) showWarning("⚠️ No valid QRs found in this PDF.");
          else showSuccess(`✅ Scanned ${foundCount} codes from PDF!`);
      } else {
          // Image Parsing
          if(!html5QrCodeRef.current) html5QrCodeRef.current = new Html5Qrcode("reader");
          try {
              const decodedText = await html5QrCodeRef.current.scanFile(file, true);
              await processScannedData(decodedText);
          } catch(e) { showWarning("⚠️ No valid QR found in image."); }
      }
  };

  const processScannedData = async (decodedText: string) => {
      try {
          const parsed = JSON.parse(decodedText);
          if(parsed.cv_sig === "CipherVault_v2" && parsed.id) {
             const history: any = await localforage.getItem('scan_history') || {};
             if(!history[parsed.id]) history[parsed.id] = { total: parsed.total, chunks: {} };
             
             if(!history[parsed.id].chunks[parsed.part]) {
                 history[parsed.id].chunks[parsed.part] = parsed.data;
                 await localforage.setItem('scan_history', history);
                 showSuccess(`✅ Saved Part ${parsed.part}/${parsed.total}!`);
             }
          } else { showWarning("⚠️ Invalid Code!"); }
      } catch(e) { showWarning("⚠️ Unknown QR Format!"); }
  };

  useEffect(() => { if (!isActive) stopCamera(); }, [isActive]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Manual Scanner</h2>
          {scanWarning && <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-3 py-1 rounded-full animate-pulse">{scanWarning}</span>}
          {scanSuccessMsg && <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 px-3 py-1 rounded-full">{scanSuccessMsg}</span>}
      </div>
      
      <div className="flex space-x-2">
          <button onClick={cameraActive ? stopCamera : startCamera} className={`flex-1 p-3 rounded-xl font-bold text-white flex justify-center items-center ${cameraActive ? 'bg-red-500' : 'bg-green-600'}`}>
              <Camera className="w-5 h-5 mr-2"/> {cameraActive ? 'Close Camera' : 'Open Camera'}
          </button>
          {cameraActive && (
              <>
                  <button onClick={() => { stopCamera(); setFacingMode(prev => prev === 'environment' ? 'user' : 'environment'); setTimeout(startCamera, 500); }} className="p-3 bg-gray-200 dark:bg-gray-800 rounded-xl"><SwitchCamera className="w-5 h-5"/></button>
                  <button onClick={toggleFlash} className={`p-3 rounded-xl ${flashOn ? 'bg-yellow-400 text-black' : 'bg-gray-200 dark:bg-gray-800'}`}><Flashlight className="w-5 h-5"/></button>
              </>
          )}
      </div>

      <div className={`w-full rounded-2xl overflow-hidden bg-black ${cameraActive ? 'min-h-[300px]' : 'h-0'}`}>
          <div id="reader" className="w-full border-none"></div>
      </div>
      <div id="hidden-scanner" className="hidden"></div>

      <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-800"></div></div><div className="relative flex justify-center"><span className="bg-gray-50 dark:bg-gray-950 px-4 text-sm text-gray-500">OR</span></div></div>

      <div className="p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
          <h3 className="font-bold mb-4">Scan from File</h3>
          {!scanFile ? (
              <label className="flex justify-center items-center w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                  <FileText className="w-6 h-6 mr-2 text-blue-500"/> <span className="font-semibold">Upload Image / PDF</span>
                  <input type="file" accept="image/*, application/pdf" className="hidden" onChange={handleScanFileUpload} />
              </label>
          ) : (
              <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-xl">
                  <span className="text-sm truncate">{scanFile.name}</span>
                  <button onClick={() => setScanFile(null)} className="text-red-500 p-2"><X className="w-5 h-5"/></button>
              </div>
          )}
      </div>
    </div>
  );
}
