import * as React from 'react';
export const Textarea = React.forwardRef(function Textarea({className='', ...props}, ref){return <textarea ref={ref} className={`min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 ${className}`} {...props}/>});
