"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import localforage from 'localforage';
import * as pdfjsLib from 'pdfjs-dist';
import { Camera, Image as ImageIcon, FileText, X, SwitchCamera, Flashlight } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ScanTab({ isActive }: { isActive: boolean }) {
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scanStatus, setScanStatus] = useState({ type: '', msg: '' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanningPDF, setIsScanningPDF] = useState(false);

  const showStatus = (type: 'error' | 'success' | 'loading', msg: string) => { 
      setScanStatus({ type, msg }); 
      if(type !== 'loading') setTimeout(() => setScanStatus({ type: '', msg: '' }), 4000); 
  };

  const startCamera = async () => {
      html5QrCodeRef.current = new Html5Qrcode("reader");
      try {
          await html5QrCodeRef.current.start({ facingMode: 'environment' }, { fps: 15, qrbox: 250 }, processScannedData, undefined);
          setCameraActive(true);
      } catch (err) { showStatus('error', "Camera error."); }
  };
  const stopCamera = async () => {
      if(html5QrCodeRef.current && cameraActive) { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); }
      setCameraActive(false);
  };

  const handleImageUpload = async (e: any) => {
      const file = e.target.files[0];
      if(!file) return;
      setPreviewUrl(URL.createObjectURL(file));
      showStatus('loading', 'Scanning Image...');
      if(!html5QrCodeRef.current) html5QrCodeRef.current = new Html5Qrcode("reader");
      try {
          const decoded = await html5QrCodeRef.current.scanFile(file, true);
          await processScannedData(decoded);
          showStatus('success', 'Image Scanned Successfully!');
      } catch(e) { showStatus('error', "No valid QR found in image."); }
  };

  const handlePDFUpload = async (e: any) => {
      const file = e.target.files[0];
      if(!file || file.type !== "application/pdf") return showStatus('error', 'Please select a valid PDF file.');
      setIsScanningPDF(true);
      
      try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const scanner = new Html5Qrcode("hidden-scanner");
          let foundCount = 0;

          for (let i = 1; i <= pdf.numPages; i++) {
              showStatus('loading', `Scanning PDF Page ${i} of ${pdf.numPages}...`);
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = viewport.width; canvas.height = viewport.height;
              await page.render({ canvasContext: ctx!, viewport }).promise;
              
              if(i === 1) setPreviewUrl(canvas.toDataURL()); // Preview first page

              try {
                  const decoded = await scanner.scanFile(canvas as any, true);
                  await processScannedData(decoded);
                  foundCount++;
              } catch(e) {} 
          }
          if(foundCount > 0) showStatus('success', `Found ${foundCount} parts in PDF!`);
          else showStatus('error', "No QRs found in PDF.");
      } catch(e) { showStatus('error', "Failed to read PDF."); }
      setIsScanningPDF(false);
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
             }
          }
      } catch(e) {}
  };

  useEffect(() => { if (!isActive) stopCamera(); }, [isActive]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {scanStatus.msg && (
          <div className={`p-3 rounded-xl font-bold flex items-center justify-center ${scanStatus.type === 'error' ? 'bg-red-100 text-red-600' : scanStatus.type === 'loading' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
              {scanStatus.msg}
          </div>
      )}

      <button onClick={cameraActive ? stopCamera : startCamera} className={`w-full p-4 rounded-2xl font-bold text-white flex justify-center items-center transition-all ${cameraActive ? 'bg-red-500' : 'bg-green-600 shadow-md'}`}>
          <Camera className="w-5 h-5 mr-2"/> {cameraActive ? 'Close Camera' : 'Open Camera to Scan'}
      </button>

      <div className={`w-full rounded-2xl overflow-hidden bg-black ${cameraActive ? 'min-h-[300px]' : 'h-0'}`}>
          <div id="reader" className="w-full border-none"></div>
      </div>
      <div id="hidden-scanner" className="hidden"></div>

      <div className="grid grid-cols-2 gap-4">
          <label className={`flex flex-col items-center p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-50 shadow-sm ${isScanningPDF ? 'opacity-50 pointer-events-none' : ''}`}>
              <ImageIcon className="w-8 h-8 text-blue-500 mb-2"/> <span className="text-sm font-bold">Scan Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <label className={`flex flex-col items-center p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer hover:bg-gray-50 shadow-sm ${isScanningPDF ? 'opacity-50 pointer-events-none' : ''}`}>
              <FileText className="w-8 h-8 text-orange-500 mb-2"/> <span className="text-sm font-bold">Scan PDF</span>
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePDFUpload} />
          </label>
      </div>

      {previewUrl && (
          <div className="relative p-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <button onClick={()=>setPreviewUrl(null)} className="absolute top-4 right-4 bg-gray-900/50 text-white p-1 rounded-full"><X className="w-5 h-5"/></button>
              <img src={previewUrl} className="w-full h-48 object-contain rounded-xl bg-gray-100 dark:bg-gray-800" />
              <p className="text-center text-xs font-bold text-gray-500 mt-2">File Preview</p>
          </div>
      )}
    </div>
  );
}
