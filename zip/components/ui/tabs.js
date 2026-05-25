import * as React from 'react';
const Ctx = React.createContext(null);
export function Tabs({value, defaultValue, onValueChange, className='', children}){const [v,setV]=React.useState(value??defaultValue); React.useEffect(()=>{if(value!==undefined)setV(value)},[value]); const set=(n)=>{setV(n); onValueChange?.(n)}; return <Ctx.Provider value={{v,set}}><div className={className}>{children}</div></Ctx.Provider>}
export function TabsList({className='', ...props}){return <div className={`inline-flex items-center rounded-xl bg-slate-100 p-1 ${className}`} {...props}/>}
export function TabsTrigger({value, className='', ...props}){const c=React.useContext(Ctx); const active=c?.v===value; return <button onClick={()=>c?.set(value)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${active?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-900'} ${className}`} {...props}/>}
export function TabsContent({value, className='', children, ...props}){const c=React.useContext(Ctx); return c?.v===value ? <div className={className} {...props}>{children}</div> : null}
