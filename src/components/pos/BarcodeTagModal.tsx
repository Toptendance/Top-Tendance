'use client';

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X, Sliders, CheckSquare, Trash2, Layers, Plus, Minus } from 'lucide-react';

export interface BarcodePrintItem {
  variantId?: string;
  productName: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  selling_price: number;
  stock_quantity?: number;
  quantity?: number;
}

interface BarcodeTagModalProps {
  variant: BarcodePrintItem | BarcodePrintItem[] | null;
  onClose: () => void;
  onPrinted?: (variantIds: string[]) => void;
}

interface SingleLabelItemProps {
  productName: string;
  sku: string;
  barcode: string;
  size: string | null;
  color: string | null;
  selling_price: number;
  isTest?: boolean;
  cellIndex?: number;
}

export function SingleLabelItem({
  productName,
  sku,
  barcode,
  size,
  color,
  selling_price,
  isTest = false,
  cellIndex,
}: SingleLabelItemProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && barcode && !isTest) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          width: 1.35,
          height: 38, // at least 10mm (38px ~ 10mm)
          displayValue: true,
          fontSize: 9,
          textMargin: 1,
          margin: 0,
        });
      } catch (err) {
        console.error('JsBarcode render error in SingleLabelItem:', err);
      }
    }
  }, [barcode, isTest]);

  if (isTest) {
    return (
      <div className="w-[52.5mm] h-[29.7mm] border border-dashed border-gray-400 p-1 flex flex-col justify-between items-center text-center select-none bg-white box-border overflow-hidden">
        <span className="text-[9px] font-mono font-bold text-gray-500">HERMA A4/40</span>
        <div className="flex flex-col items-center">
          <span className="text-sm font-black font-mono text-gray-900">#{cellIndex}</span>
          <span className="text-[7.5px] text-gray-400">52.5 × 29.7 mm</span>
        </div>
        <span className="text-[7.5px] text-gray-400">CALIBRATION CANON G2410</span>
      </div>
    );
  }

  return (
    <div
      className="w-[52.5mm] h-[29.7mm] bg-white flex flex-col justify-between items-center text-center select-none box-border overflow-hidden"
      style={{
        paddingTop: '2mm',
        paddingBottom: '2.5mm',
        paddingLeft: '3.5mm',
        paddingRight: '3.5mm',
      }}
    >
      {/* Product Name & SKU / Variant */}
      <div className="w-full leading-tight">
        <p className="text-[9px] font-black uppercase tracking-tight text-black truncate w-full">
          {productName}
        </p>
        <div className="flex justify-between items-center text-[7.5px] text-black px-0.5 font-mono">
          <span className="truncate max-w-[50%]">{sku}</span>
          <span className="truncate max-w-[50%] text-right font-medium">
            {size ? `T: ${size}` : ''} {color ? `• ${color}` : ''}
          </span>
        </div>
      </div>

      {/* Code128 Vector Barcode SVG with quiet zones */}
      <div className="w-full flex justify-center items-center px-1 my-auto">
        <svg ref={svgRef} className="max-w-full" />
      </div>

      {/* Brand & Price */}
      <div className="w-full flex justify-between items-baseline px-0.5 border-t border-gray-200 pt-0.5 leading-none">
        <span className="text-[7.5px] font-bold uppercase tracking-wider text-black">Top Tendance</span>
        <span className="text-[10px] font-black text-black font-mono">
          {Number(selling_price).toFixed(3)} DT
        </span>
      </div>
    </div>
  );
}

export default function BarcodeTagModal({ variant, onClose, onPrinted }: BarcodeTagModalProps) {
  // Normalize items array: support both single variant and multi-item list
  const [items, setItems] = useState<Array<BarcodePrintItem & { printQty: number }>>([]);
  const [startPosition, setStartPosition] = useState<number>(1);
  const [isTestPage, setIsTestPage] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Calibration offsets in mm (stored in localStorage)
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);

  // Initialize or re-sync items when `variant` prop changes
  useEffect(() => {
    if (!variant) {
      setItems([]);
      return;
    }
    const rawList = Array.isArray(variant) ? variant : [variant];
    const initialList = rawList.map((item) => ({
      ...item,
      printQty: Math.max(1, item.quantity ?? 1),
    }));
    setItems(initialList);
  }, [variant]);

  // Load saved calibration offsets from localStorage on mount
  useEffect(() => {
    try {
      const savedX = localStorage.getItem('herma_a4_offset_x');
      const savedY = localStorage.getItem('herma_a4_offset_y');
      if (savedX !== null) setOffsetX(parseFloat(savedX) || 0);
      if (savedY !== null) setOffsetY(parseFloat(savedY) || 0);
    } catch (e) {
      console.warn('Could not read calibration offsets from localStorage:', e);
    }
  }, []);

  const handleOffsetXChange = (val: number) => {
    setOffsetX(val);
    try {
      localStorage.setItem('herma_a4_offset_x', val.toString());
    } catch (e) {
      console.warn('Could not save offset_x:', e);
    }
  };

  const handleOffsetYChange = (val: number) => {
    setOffsetY(val);
    try {
      localStorage.setItem('herma_a4_offset_y', val.toString());
    } catch (e) {
      console.warn('Could not save offset_y:', e);
    }
  };

  // Item tuning actions
  const updateItemQty = (index: number, newQty: number) => {
    setItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], printQty: Math.max(1, newQty) };
      }
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const setGlobalQty = (qty: number) => {
    setItems((prev) => prev.map((item) => ({ ...item, printQty: Math.max(1, qty) })));
  };

  if (!variant || items.length === 0) return null;

  // Flatten sequence of items according to printQty
  const flatLabelsQueue: BarcodePrintItem[] = [];
  items.forEach((item) => {
    for (let i = 0; i < item.printQty; i++) {
      flatLabelsQueue.push(item);
    }
  });

  const totalLabels = flatLabelsQueue.length;
  const totalCellsNeeded = (startPosition - 1) + totalLabels;
  const totalPages = Math.max(1, Math.ceil(totalCellsNeeded / 40));

  const handlePrint = (testMode: boolean = false) => {
    setIsTestPage(testMode);
    if (!testMode && onPrinted) {
      const ids = items
        .map((it) => it.variantId)
        .filter((id): id is string => Boolean(id));
      if (ids.length > 0) {
        onPrinted(ids);
      }
    }
    // Give React time to render the print DOM structure
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Build the list of pages and cells for printing
  const buildPrintPages = () => {
    const pages: Array<Array<{ type: 'empty' | 'label'; item?: BarcodePrintItem; id: string }>> = [];

    for (let p = 0; p < totalPages; p++) {
      const pageCells: Array<{ type: 'empty' | 'label'; item?: BarcodePrintItem; id: string }> = [];
      for (let c = 0; c < 40; c++) {
        const globalIndex = p * 40 + c;
        if (globalIndex < startPosition - 1) {
          // Pre-skip cells on the first page
          pageCells.push({ type: 'empty', id: `skip-${globalIndex}` });
        } else {
          const itemIndex = globalIndex - (startPosition - 1);
          if (itemIndex < totalLabels) {
            pageCells.push({
              type: 'label',
              item: flatLabelsQueue[itemIndex],
              id: `lbl-${globalIndex}`,
            });
          } else {
            // Empty trailing cells to preserve strict 4x10 grid on last page
            pageCells.push({ type: 'empty', id: `tail-${globalIndex}` });
          }
        }
      }
      pages.push(pageCells);
    }
    return pages;
  };

  const printPages = buildPrintPages();
  const isMultiItem = items.length > 1;

  // Color generator for multi-item preview blocks in visualizer
  const getItemColor = (itemSku: string) => {
    const colors = [
      'bg-blue-600 text-white',
      'bg-emerald-600 text-white',
      'bg-purple-600 text-white',
      'bg-amber-600 text-white',
      'bg-rose-600 text-white',
      'bg-indigo-600 text-white',
      'bg-teal-600 text-white',
      'bg-orange-600 text-white',
    ];
    let hash = 0;
    for (let i = 0; i < itemSku.length; i++) {
      hash = itemSku.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      {/* Strict A4 Sticker Sheet (4 columns x 10 rows) print stylesheet */}
      <style jsx global>{`
        @media print {
          /* Hide everything in the document by default */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }

          /* Show only the designated A4 print sheets container */
          #print-sheets-container,
          #print-sheets-container * {
            visibility: visible !important;
          }

          #print-sheets-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .a4-print-sheet {
            width: 210mm !important;
            height: 297mm !important;
            display: grid !important;
            grid-template-columns: repeat(4, 52.5mm) !important;
            grid-template-rows: repeat(10, 29.7mm) !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .a4-print-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .a4-print-cell {
            width: 52.5mm !important;
            height: 29.7mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          @page {
            size: 210mm 297mm !important;
            margin: 0mm !important;
          }
        }
      `}</style>

      {/* Off-screen / Print-only container */}
      <div
        id="print-sheets-container"
        className="hidden print:block"
        style={{
          transform: `translate(${offsetX}mm, ${offsetY}mm)`,
        }}
      >
        {isTestPage ? (
          <div className="a4-print-sheet">
            {Array.from({ length: 40 }).map((_, idx) => (
              <div key={`test-${idx}`} className="a4-print-cell">
                <SingleLabelItem
                  productName={items[0].productName}
                  sku={items[0].sku}
                  barcode={items[0].barcode}
                  size={items[0].size}
                  color={items[0].color}
                  selling_price={items[0].selling_price}
                  isTest={true}
                  cellIndex={idx + 1}
                />
              </div>
            ))}
          </div>
        ) : (
          printPages.map((page, pageIdx) => (
            <div key={`page-${pageIdx}`} className="a4-print-sheet">
              {page.map((cell) => (
                <div key={cell.id} className="a4-print-cell">
                  {cell.type === 'label' && cell.item ? (
                    <SingleLabelItem
                      productName={cell.item.productName}
                      sku={cell.item.sku}
                      barcode={cell.item.barcode}
                      size={cell.item.size}
                      color={cell.item.color}
                      selling_price={cell.item.selling_price}
                    />
                  ) : (
                    // Blank placeholder cell for alignment
                    <div className="w-[52.5mm] h-[29.7mm] bg-transparent" />
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-lg w-full flex flex-col items-center max-h-[95vh] overflow-y-auto">
        <div className="w-full flex justify-between items-center mb-3 pb-2 border-b">
          <div>
            <h3 className="font-bold text-sm text-gray-900">
              {isMultiItem ? `Impression par Lot (${items.length} références)` : "Étiquette Code-Barres"} - Planche A4
            </h3>
            <p className="text-[11px] text-gray-500">HERMA 40 étiquettes (4 colonnes × 10 lignes)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Multi-Item Breakdown or Single Item Preview */}
        {isMultiItem ? (
          <div className="w-full mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Layers size={14} className="text-gray-500" /> Articles sélectionnés
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">Tous à:</span>
                <button
                  type="button"
                  onClick={() => setGlobalQty(1)}
                  className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded font-semibold text-gray-700"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalQty(2)}
                  className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded font-semibold text-gray-700"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalQty(5)}
                  className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded font-semibold text-gray-700"
                >
                  5
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-gray-50/50">
              {items.map((item, index) => (
                <div key={item.sku + index} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.productName}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono mt-0.5">
                      <span>{item.sku}</span>
                      {item.size && <span className="bg-gray-200 px-1.5 rounded text-[10px] text-gray-700 font-sans">T: {item.size}</span>}
                      {item.color && <span className="bg-gray-200 px-1.5 rounded text-[10px] text-gray-700 font-sans">{item.color}</span>}
                      <span className="font-bold text-gray-800 ml-auto">{Number(item.selling_price).toFixed(3)} DT</span>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateItemQty(index, item.printQty - 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.printQty}
                      onChange={(e) => updateItemQty(index, parseInt(e.target.value) || 1)}
                      className="w-10 h-6 text-center text-xs font-mono font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={() => updateItemQty(index, item.printQty + 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      <Plus size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="ml-1 p-1 text-gray-400 hover:text-red-600 transition"
                      title="Retirer de l'impression"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Single Item Label Preview */
          <div className="border border-gray-300 rounded-lg shadow-xs overflow-hidden mb-4 bg-white">
            <SingleLabelItem
              productName={items[0].productName}
              sku={items[0].sku}
              barcode={items[0].barcode}
              size={items[0].size}
              color={items[0].color}
              selling_price={items[0].selling_price}
            />
          </div>
        )}

        {/* Form controls for quantity (if single) & start position */}
        <div className={`w-full grid ${isMultiItem ? 'grid-cols-1' : 'grid-cols-2'} gap-3 mb-3 bg-gray-50 p-3 rounded-xl border border-gray-100`}>
          {!isMultiItem && (
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Quantité d'étiquettes
              </label>
              <input
                type="number"
                min="1"
                value={items[0]?.printQty || 1}
                onChange={(e) => updateItemQty(0, parseInt(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black font-semibold text-gray-900"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-bold text-gray-700">
                Commencer à l'étiquette n° (1 - 40)
              </label>
              <span className="text-[10px] text-gray-400">Pour réutiliser une feuille entamée</span>
            </div>
            <input
              type="number"
              min="1"
              max="40"
              value={startPosition}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setStartPosition(Math.min(40, Math.max(1, val)));
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-black font-semibold text-gray-900"
            />
          </div>
        </div>

        {/* 4x10 Sheet Visualizer preview */}
        <div className="w-full mb-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-bold text-gray-700">
              Aperçu 1ère feuille (40 cases)
            </span>
            <span className="text-[10px] font-medium text-gray-600">
              Total: <b className="font-bold text-black">{totalLabels}</b> étiquette(s) • <b className="font-bold text-black">{totalPages}</b> {totalPages > 1 ? 'pages A4' : 'page A4'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 p-1.5 bg-white border border-gray-200 rounded-lg max-w-[200px] mx-auto shadow-inner">
            {Array.from({ length: 40 }).map((_, idx) => {
              const cellNum = idx + 1;
              const isSkipped = cellNum < startPosition;
              const labelIndex = cellNum - startPosition;
              const isFilledOnFirstPage = !isSkipped && labelIndex < totalLabels;
              const assignedItem = isFilledOnFirstPage ? flatLabelsQueue[labelIndex] : null;

              return (
                <button
                  key={cellNum}
                  type="button"
                  onClick={() => setStartPosition(cellNum)}
                  title={
                    isSkipped
                      ? `Position ${cellNum} (cliquer pour commencer ici)`
                      : assignedItem
                      ? `Position ${cellNum}: ${assignedItem.productName} (${assignedItem.sku})`
                      : `Position ${cellNum} (vide)`
                  }
                  className={`h-4 text-[8px] flex items-center justify-center rounded font-mono font-bold transition-all ${
                    isSkipped
                      ? 'bg-gray-200 text-gray-400 line-through opacity-70'
                      : assignedItem
                      ? isMultiItem
                        ? getItemColor(assignedItem.sku)
                        : 'bg-black text-white'
                      : 'bg-gray-50 text-gray-500 border border-dashed border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {cellNum}
                </button>
              );
            })}
          </div>

          <div className="flex justify-center items-center gap-3 mt-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-gray-200 border border-gray-300"></span> Déjà utilisée
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-black"></span> À imprimer
            </span>
            {totalPages > 1 && (
              <span className="text-amber-700 font-semibold">
                + {totalPages - 1} autre(s) page(s)
              </span>
            )}
          </div>
        </div>

        {/* Calibration offset toggle & controls */}
        <div className="w-full mb-4">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 hover:text-black transition"
          >
            <Sliders size={13} />
            <span>{showSettings ? 'Masquer le réglage du décalage (calibration)' : 'Ajuster le décalage imprimante (mm)'}</span>
          </button>

          {showSettings && (
            <div className="mt-2 p-3 bg-amber-50/60 border border-amber-200 rounded-xl grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-amber-900 mb-1">
                  Décalage X (mm, horizontal)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={offsetX}
                  onChange={(e) => handleOffsetXChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-white border border-amber-300 rounded font-mono text-gray-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-amber-900 mb-1">
                  Décalage Y (mm, vertical)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={offsetY}
                  onChange={(e) => handleOffsetYChange(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs bg-white border border-amber-300 rounded font-mono text-gray-900"
                />
              </div>
              <p className="col-span-2 text-[9px] text-amber-800">
                Enregistré automatiquement dans ce navigateur pour votre Canon G2410.
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 w-full">
          <div className="flex gap-2 w-full">
            <button
              onClick={() => handlePrint(false)}
              className="flex-1 bg-black text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-800 transition"
            >
              <Printer size={15} /> Imprimer {totalLabels > 1 ? `(${totalLabels} étiquettes • ${totalPages} p.)` : "l'étiquette"}
            </button>
            <button
              onClick={() => handlePrint(true)}
              className="px-3 py-2.5 bg-gray-100 border border-gray-300 text-gray-800 rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:bg-gray-200 transition"
              title="Imprime une grille numérotée sur papier normal pour calibrer l'alignement"
            >
              <CheckSquare size={14} /> Page de test
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2 border rounded-xl font-semibold text-xs hover:bg-gray-100 transition text-gray-600"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}


