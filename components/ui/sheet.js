import * as React from 'react';

const SheetContext = React.createContext({ open: false, setOpen: () => {} });

export function Sheet({ open = false, onOpenChange, children }) {
  const setOpen = React.useCallback((value) => onOpenChange?.(value), [onOpenChange]);
  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({ asChild, children, ...props }) {
  const { setOpen } = React.useContext(SheetContext);
  const handleClick = (event) => {
    props.onClick?.(event);
    if (!event.defaultPrevented) setOpen(true);
  };
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: (event) => {
        children.props?.onClick?.(event);
        handleClick(event);
      },
    });
  }
  return <button type="button" {...props} onClick={handleClick}>{children}</button>;
}

export function SheetContent({ className = '', children, ...props }) {
  const { open, setOpen } = React.useContext(SheetContext);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
      <aside
        className={`h-full w-full max-w-[430px] overflow-auto border-l border-slate-200 bg-white p-5 text-slate-900 shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {children}
      </aside>
    </div>
  );
}
SheetContent.displayName = 'SheetContent';

export function SheetHeader({ className = '', ...props }) {
  return <div className={`mb-4 ${className}`} {...props} />;
}
export function SheetTitle({ className = '', ...props }) {
  return <h2 className={`text-lg font-bold ${className}`} {...props} />;
}
