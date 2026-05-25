export function Avatar({className='', ...props}){return <div className={`relative flex shrink-0 overflow-hidden rounded-full bg-slate-100 ${className}`} {...props}/>}
export function AvatarImage({src, alt='', className='', ...props}){return src ? <img src={src} alt={alt} className={`aspect-square h-full w-full object-cover ${className}`} {...props}/> : null}
export function AvatarFallback({className='', ...props}){return <div className={`flex h-full w-full items-center justify-center rounded-full bg-slate-100 ${className}`} {...props}/>}
