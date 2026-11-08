'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Flashlight, RefreshCw, AlertCircle } from 'lucide-react';
import { playBeep } from '@/utils/posAudio';

interface MobileScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  title?: string;
}

export default function MobileScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scanner Caméra Mobile',
}: MobileScannerModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);
  const [isStarting, setIsStarting] = useState<boolean>(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'mobile-qr-reader-region';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsStarting(true);
    setErrorMessage(null);

    const initScanner = async () => {
      // 1. Check HTTPS or localhost requirement (MediaDevices security standard)
      if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        setErrorMessage(
          'La caméra requiert une connexion sécurisée HTTPS. Veuillez ouvrir cette page via https://.'
        );
        setIsStarting(false);
        return;
      }

      // 2. Check browser support for mediaDevices
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setErrorMessage(
          'Votre navigateur ne supporte pas l’accès direct à la caméra. Veuillez mettre à jour Safari ou Chrome.'
        );
        setIsStarting(false);
        return;
      }

      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setErrorMessage('Aucune caméra détectée sur cet appareil.');
          setIsStarting(false);
          return;
        }

        setCameras(devices);

        // Prefer back camera (environment)
        let preferredIndex = devices.findIndex((d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        if (preferredIndex === -1) preferredIndex = 0;
        setCurrentCameraIndex(preferredIndex);

        const cameraId = devices[preferredIndex].id;
        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          cameraId,
          {
            fps: 15,
            qrbox: { width: 260, height: 180 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // Success scan
            try {
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(100);
              }
            } catch (_) {}
            playBeep('success');
            onScan(decodedText);
          },
          () => {
            // Periodic frame decode failure - ignore
          }
        );

        if (!isMounted) {
          html5QrCode.stop().catch(() => {});
          return;
        }

        setIsStarting(false);

        // Check if torch / flashlight is supported
        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities();
          if (capabilities && (capabilities as any).torch) {
            setHasTorch(true);
          }
        } catch (_) {}
      } catch (err: any) {
        if (!isMounted) return;
        setIsStarting(false);
        const msg = err?.message || '';
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setErrorMessage('Accès caméra refusé. Veuillez autoriser la caméra dans votre navigateur.');
        } else {
          setErrorMessage('Impossible d’activer la caméra: ' + (err?.message || 'Erreur inconnue'));
        }
      }
    };

    // Small delay to let the DOM container mount
    const timer = setTimeout(initScanner, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch (_) {}
  };

  const switchCamera = async () => {
    if (!scannerRef.current || cameras.length <= 1) return;
    try {
      await scannerRef.current.stop();
      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);
      setIsStarting(true);
      await scannerRef.current.start(
        cameras[nextIndex].id,
        {
          fps: 15,
          qrbox: { width: 260, height: 180 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(100);
            }
          } catch (_) {}
          playBeep('success');
          onScan(decodedText);
        },
        () => {}
      );
      setIsStarting(false);
    } catch (err: any) {
      setErrorMessage('Erreur lors du changement de caméra: ' + (err?.message || ''));
      setIsStarting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full flex flex-col relative border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black text-white">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-emerald-400" />
            <h3 className="text-sm font-bold tracking-wide">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[320px] overflow-hidden">
          <div id={scannerContainerId} className="w-full h-full max-h-[380px]" />

          {isStarting && !errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-3 z-10">
              <RefreshCw className="animate-spin text-white" size={32} />
              <p className="text-xs text-gray-300">Initialisation de la caméra...</p>
            </div>
          )}

          {errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-6 text-center text-white gap-3 z-10">
              <AlertCircle className="text-red-400" size={36} />
              <p className="text-xs text-red-200 max-w-xs">{errorMessage}</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-1.5 bg-white text-black font-semibold text-xs rounded-lg hover:bg-gray-200"
              >
                Fermer
              </button>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="p-3 bg-gray-50 flex items-center justify-between border-t border-gray-200 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition shadow-xs text-xs"
              >
                <RefreshCw size={13} />
                <span>Changer Caméra</span>
              </button>
            )}

            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg font-medium transition shadow-xs text-xs ${
                  torchOn
                    ? 'bg-amber-400 border-amber-500 text-black'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Flashlight size={13} />
                <span>{torchOn ? 'Flash Activé' : 'Flash'}</span>
              </button>
            )}
          </div>

          <span className="text-[11px] text-gray-500 font-mono">
            1D / 2D QR Code
          </span>
        </div>
      </div>
    </div>
  );
}

