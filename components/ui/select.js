import * as React from 'react';
const Ctx = React.createContext(null);
export function Select({value, defaultValue, onValueChange, children}){const [v,setV]=React.useState(value??defaultValue??''); React.useEffect(()=>{if(value!==undefined)setV(value)},[value]); const opts=[]; React.Children.forEach(children,ch=>{if(ch?.type?.displayName==='SelectContent'){React.Children.forEach(ch.props.children,it=>{if(it?.props) opts.push({value:it.props.value, label:it.props.children})})}}); const set=e=>{setV(e.target.value); onValueChange?.(e.target.value)}; return <Ctx.Provider value={{v,set,opts}}><div>{children}</div></Ctx.Provider>}
export function SelectTrigger({className='', children}){const c=React.useContext(Ctx); return <select value={c?.v||''} onChange={c?.set} className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-100 ${className}`}>{c?.opts?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}
export function SelectValue(){return null}
export function SelectContent({children}){return <div className="hidden">{children}</div>}
SelectContent.displayName='SelectContent';
export function SelectItem({children}){return <>{children}</>}
