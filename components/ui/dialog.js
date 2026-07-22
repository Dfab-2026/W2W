export function Dialog({open, onOpenChange, children}){return open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onClick={()=>onOpenChange?.(false)}>{children}</div> : null}
export function DialogContent({className='', children, ...props}){return <div className={`max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl ${className}`} onClick={e=>e.stopPropagation()} {...props}>{children}</div>}
export function DialogHeader({className='', ...props}){return <div className={`mb-4 space-y-1 ${className}`} {...props}/>}
export function DialogTitle({className='', ...props}){return <h2 className={`text-lg font-bold ${className}`} {...props}/>}
export function DialogDescription({className='', ...props}){return <p className={`text-sm text-slate-500 ${className}`} {...props}/>}
export function DialogFooter({className='', ...props}){return <div className={`mt-4 flex justify-end gap-2 ${className}`} {...props}/>}
