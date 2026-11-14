'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X, Truck, Phone, MapPin, Calendar, Package, DollarSign } from 'lucide-react';
import { formatPrice } from '@/utils/currency';

interface DeliveryItem {
  id?: string;
  variant_id: string;
  product_name: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  unit_price: number;
}

interface DeliveryShippingSlipModalProps {
  delivery: {
    id: string;
    tracking_number?: string | null;
    courier_name: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_phone_alt?: string | null;
    address: string;
    city: string;
    governorate: string;
    cod_amount: number;
    shipping_fee: number;
    status: string;
    payment_status: string;
    notes?: string | null;
    created_at: string;
    delivery_items?: DeliveryItem[];
  } | null;
  onClose: () => void;
}

export default function DeliveryShippingSlipModal({ delivery, onClose }: DeliveryShippingSlipModalProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (delivery && barcodeRef.current) {
      try {
        const codeValue = delivery.tracking_number || delivery.id.slice(0, 12).toUpperCase();
        JsBarcode(barcodeRef.current, codeValue, {
          format: 'CODE128',
          width: 1.6,
          height: 48,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          text: `COLIS: ${codeValue}`,
          margin: 6,
        });
      } catch (err) {
        console.error('Error generating delivery slip barcode:', err);
      }
    }
  }, [delivery]);

  if (!delivery) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalItemsCount = delivery.delivery_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #shipping-slip-container, #shipping-slip-container * {
            visibility: visible;
          }
          #shipping-slip-container {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 24px;
            box-shadow: none !important;
            border: 1px solid #111 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Top bar controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 no-print">
          <div className="flex items-center gap-2">
            <Truck size={20} className="text-gray-900" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-gray-900">
              Bordereau d'Expédition
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Slip Content */}
        <div className="overflow-y-auto p-6 sm:p-8 flex-1">
          <div
            id="shipping-slip-container"
            className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-300 font-sans space-y-5"
          >
            {/* Header: Store details & Courier logo badge */}
            <div className="flex justify-between items-start border-b border-gray-200 pb-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-gray-950 uppercase">
                  Top Tendance
                </h1>
                <p className="text-xs text-gray-500 font-medium">Boutique Mode & Prêt-à-porter</p>
                <p className="text-xs text-gray-500 font-medium">Tél: +216 71 000 000 / 98 000 000</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-black text-white rounded-lg text-xs font-black tracking-widest uppercase">
                  {delivery.courier_name}
                </span>
                <p className="text-[11px] text-gray-400 font-mono mt-1">
                  {new Date(delivery.created_at).toLocaleDateString('fr-TN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Scannable Barcode */}
            <div className="flex flex-col items-center justify-center py-2 bg-gray-50 rounded-xl border border-gray-200">
              <svg ref={barcodeRef} className="max-w-full" />
              <div className="text-[11px] font-mono text-gray-600 font-bold mt-1">
                Colis ID: #{delivery.id.slice(0, 8).toUpperCase()}
              </div>
            </div>

            {/* Recipient Details Card */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-900">
                <MapPin size={14} /> Destinataire & Adresse
              </div>
              <div className="text-sm font-black text-gray-900">{delivery.recipient_name}</div>
              <div className="flex items-center gap-3 text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1">
                  <Phone size={12} className="text-gray-500" /> {delivery.recipient_phone}
                </span>
                {delivery.recipient_phone_alt && (
                  <span className="text-gray-500">/ Alt: {delivery.recipient_phone_alt}</span>
                )}
              </div>
              <div className="text-xs text-gray-800 leading-relaxed font-medium">
                {delivery.address}, <span className="font-bold">{delivery.city}</span> ({delivery.governorate})
              </div>
              {delivery.notes && (
                <div className="text-xs italic bg-white/80 p-2 rounded-lg border border-amber-200 text-amber-950 mt-1">
                  Note: {delivery.notes}
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-gray-600 border-b pb-1">
                <span className="flex items-center gap-1">
                  <Package size={13} /> Contenu du Colis ({totalItemsCount} pièces)
                </span>
                <span>Prix U.</span>
              </div>
              <div className="divide-y divide-gray-100 text-xs">
                {delivery.delivery_items && delivery.delivery_items.length > 0 ? (
                  delivery.delivery_items.map((item, idx) => (
                    <div key={item.id || idx} className="py-1.5 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-gray-900">{item.product_name}</span>
                        {(item.size || item.color) && (
                          <span className="text-gray-500 ml-1">
                            ({[item.size, item.color].filter(Boolean).join(' - ')})
                          </span>
                        )}
                        <span className="text-gray-600 font-bold ml-2">× {item.quantity}</span>
                      </div>
                      <div className="font-mono text-gray-800">
                        {formatPrice(item.unit_price * item.quantity)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic py-1">Articles non détaillés</p>
                )}
              </div>
            </div>

            {/* COD & Shipping Total */}
            <div className="border-t-2 border-gray-950 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-600 font-medium">
                <span>Frais de livraison:</span>
                <span>{formatPrice(delivery.shipping_fee)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-extrabold text-gray-950 bg-gray-100 p-3 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <DollarSign size={16} className="text-emerald-700" />
                  <span>TOTAL CONTRE REMBOURSEMENT (COD):</span>
                </div>
                <span className="text-lg font-black text-emerald-700 font-mono">
                  {formatPrice(delivery.cod_amount)}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 text-center font-medium mt-1">
                Le destinataire doit régler le montant exact au livreur avant ouverture du colis.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex gap-3 no-print">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 transition"
          >
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-black text-white rounded-xl font-black text-sm hover:bg-gray-800 transition flex items-center justify-center gap-2 shadow-lg shadow-black/10"
          >
            <Printer size={16} /> Imprimer Bordereau
          </button>
        </div>
      </div>
    </div>
  );
}
