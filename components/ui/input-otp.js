export function InputOTP({value='', onChange, maxLength=6, children, className=''}){return <input value={value} maxLength={maxLength} onChange={e=>onChange?.(e.target.value.replace(/\D/g,'').slice(0,maxLength))} className={`h-12 w-full rounded-xl border border-slate-200 px-4 text-center text-lg tracking-[.5em] outline-none focus:ring-2 focus:ring-slate-100 ${className}`} placeholder="••••••"/>}
export function InputOTPGroup({className='', ...props}){return <div className={`flex gap-2 ${className}`} {...props}/>}
export function InputOTPSlot(){return null}
