export function Card({className='', ...props}){return <div className={`w2w-card rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-sm ${className}`} {...props}/>}
export function CardHeader({className='', ...props}){return <div className={`p-5 pb-3 ${className}`} {...props}/>}
export function CardContent({className='', ...props}){return <div className={`p-5 pt-3 ${className}`} {...props}/>}
export function CardTitle({className='', ...props}){return <h3 className={`text-lg font-bold leading-none tracking-tight ${className}`} {...props}/>}
export function CardDescription({className='', ...props}){return <p className={`text-sm text-slate-500 ${className}`} {...props}/>}
