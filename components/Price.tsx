'use client';

import { displayPrice } from '@/lib/currency';

interface PriceProps {
  priceBgn: number;
  className?: string;
  showBoth?: boolean; // Show both currencies
  inline?: boolean; // Display inline (horizontal) vs stacked
  unit?: string; // Unit of measurement (ml, g, kg, pcs)
  quantity?: number; // Quantity
}

export default function Price({ 
  priceBgn, 
  className = '', 
  showBoth = true,
  inline = true,
  unit,
  quantity
}: PriceProps) {
  const bgnPrice = displayPrice(priceBgn, 'BGN');
  const eurPrice = displayPrice(priceBgn, 'EUR');
  
  // Format unit display
  const getUnitLabel = () => {
    if (!unit) return '';
    const unitMap: Record<string, string> = {
      'ml': 'ml',
      'g': 'g',
      'kg': 'kg',
      'pcs': 'бр.'
    };
    const unitLabel = unitMap[unit] || unit;
    return quantity ? `${quantity} ${unitLabel}` : unitLabel;
  };
  
  const unitDisplay = getUnitLabel();

  if (!showBoth) {
    return <span className={className}>{eurPrice}{unitDisplay && <span className="text-sm opacity-70 ml-2">({unitDisplay})</span>}</span>;
  }

  if (inline) {
    return (
      <span className={className}>
        <span className="font-semibold">{eurPrice}</span>
        <span className="opacity-70 mx-2">/</span>
        <span className="opacity-90">{bgnPrice}</span>
        {unitDisplay && <span className="text-sm opacity-70 ml-2">({unitDisplay})</span>}
      </span>
    );
  }

  // Stacked layout
  return (
    <span className={`flex flex-col ${className}`}>
      <span className="font-semibold">{eurPrice}</span>
      <span className="text-sm opacity-70">{bgnPrice}</span>
      {unitDisplay && <span className="text-sm opacity-70 mt-1">({unitDisplay})</span>}
    </span>
  );
}


