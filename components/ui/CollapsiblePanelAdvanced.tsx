// components/ui/CollapsiblePanelAdvanced.tsx
"use client";

import { useState, ReactNode } from 'react';

interface CollapsiblePanelAdvancedProps {
  children: ReactNode;
  title?: string;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  variant?: 'default' | 'bordered' | 'shadow' | 'minimal' | 'accent';
  showClosedHint?: boolean;
  closedHintText?: string;
  onToggle?: (isOpen: boolean) => void; // Make this optional
  icon?: ReactNode;
  actions?: ReactNode;
  collapsible?: boolean;
}

export function CollapsiblePanelAdvanced({
  children,
  title,
  defaultOpen = true,
  className = "",
  headerClassName = "",
  contentClassName = "",
  variant = 'default',
  showClosedHint = true,
  closedHintText = "Click + to expand",
  onToggle, // Now optional
  icon,
  actions,
  collapsible = true
}: CollapsiblePanelAdvancedProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    if (collapsible) {
      const newState = !isOpen;
      setIsOpen(newState);
      onToggle?.(newState);
    }
  };

  const variantStyles = {
    default: "bg-white rounded-lg shadow-md border border-gray-200",
    bordered: "bg-white rounded-lg border-2 border-gray-300",
    shadow: "bg-white rounded-lg shadow-lg",
    minimal: "bg-gray-50 rounded-lg",
    accent: "bg-white rounded-lg border-l-4 border-blue-500 shadow-md"
  };

  const headerVariantStyles = {
    default: "bg-gray-50 border-b border-gray-200",
    bordered: "bg-white border-b-2 border-gray-300",
    shadow: "bg-white border-b border-gray-200",
    minimal: "bg-transparent",
    accent: "bg-blue-50 border-b border-blue-100"
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`}>
      {/* Panel Header */}
      <div className={`flex items-center justify-between p-4 rounded-t-lg ${headerVariantStyles[variant]} ${headerClassName}`}>
        <div className="flex items-center gap-3">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          {title && (
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {actions}
          {collapsible && (
            <button
              onClick={handleToggle}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex-shrink-0"
              aria-label={isOpen ? "Collapse panel" : "Expand panel"}
            >
              <svg 
                className={`w-5 h-5 transform transition-transform duration-200 ${
                  isOpen ? 'rotate-45' : 'rotate-0'
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {(!collapsible || isOpen) && (
        <div className={contentClassName}>
          {children}
        </div>
      )}

      {/* Closed State Indicator */}
      {collapsible && !isOpen && showClosedHint && (
        <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-b-lg">
          <span className="text-sm">{closedHintText}</span>
        </div>
      )}
    </div>
  );
}