'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X } from 'lucide-react';

interface BarcodeTagModalProps {
  variant: {
    productName: string;
    sku: string;
    barcode: string;
    size: string | null;
    color: string | null;
    selling_price: number;
  } | null;
  onClose: () => void;
}

export default function BarcodeTagModal({ variant, onClose }: BarcodeTagModalProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (variant && barcodeRef.current && variant.barcode) {
      try {
        JsBarcode(barcodeRef.current, variant.barcode, {
          format: 'CODE128',
          width: 1.5,
          height: 38,
          displayValue: true,
          fontSize: 10,
          margin: 0,
        });
      } catch (err) {
        console.error('JsBarcode rendering error:', err);
      }
    }
  }, [variant]);

  if (!variant) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Thermal 50mm x 30mm print stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #barcode-label-area,
          #barcode-label-area * {
            visibility: visible;
          }
          #barcode-label-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 50mm;
            height: 30mm;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
          }
          @page {
            size: 50mm 30mm;
            margin: 0;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-4 pb-2 border-b">
          <h3 className="font-bold text-sm text-gray-900">Étiquette Code-Barres (50mm × 30mm)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Thermal Label Preview */}
        <div
          id="barcode-label-area"
          className="w-[50mm] h-[30mm] border border-gray-400 bg-white p-1.5 flex flex-col justify-between items-center text-center shadow-sm rounded overflow-hidden select-none"
        >
          <div className="w-full">
            <p className="text-[10px] font-extrabold uppercase tracking-tight text-gray-900 truncate">
              {variant.productName}
            </p>
            <div className="flex justify-between items-center text-[8px] text-gray-600 px-1 font-mono">
              <span>{variant.sku}</span>
              <span>
                {variant.size ? `T: ${variant.size}` : ''} {variant.color ? `• ${variant.color}` : ''}
              </span>
            </div>
          </div>

          <div className="flex justify-center items-center py-0.5">
            <svg ref={barcodeRef} className="max-w-full" />
          </div>

          <div className="w-full flex justify-between items-baseline px-1 border-t border-gray-200 pt-0.5">
            <span className="text-[8px] font-bold uppercase text-gray-500">Top Tendance</span>
            <span className="text-[11px] font-black text-gray-950 font-mono">
              {Number(variant.selling_price).toFixed(3)} DT
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-2 w-full">
          <button
            onClick={handlePrint}
            className="flex-1 bg-black text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition"
          >
            <Printer size={16} /> Imprimer Étiquette
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border rounded-xl font-semibold text-xs hover:bg-gray-100 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

