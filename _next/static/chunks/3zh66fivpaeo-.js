(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,71400,e=>{e.v(t=>Promise.all(["static/chunks/1isww-nkwqy_c.js"].map(t=>e.l(t))).then(()=>t(32322)))},85849,e=>{"use strict";var t=e.i(43476),r=e.i(71645);let n=[17.4435,78.3772];e.s(["default",0,function({issues:l=[],selectedIssueId:i,onSelectIssue:a,onIssueClick:o,isPicker:s=!1,pickerCoords:c,pickerLat:u,pickerLng:d,onLocationPick:f,onLocationSelect:p,height:g="550px",zoom:m=13,center:h=n,interactive:x=!0}){let b=(0,r.useRef)(null),v=(0,r.useRef)(null),w=(0,r.useRef)({}),y=(0,r.useRef)(null),k=(0,r.useRef)(null),[j,z]=(0,r.useState)(!1),C=(0,r.useRef)({center:h,zoom:m,interactive:x,isPicker:s,pickerCoords:c,pickerLat:u,pickerLng:d,onLocationPick:f,onLocationSelect:p});(0,r.useEffect)(()=>{C.current={center:h,zoom:m,interactive:x,isPicker:s,pickerCoords:c,pickerLat:u,pickerLng:d,onLocationPick:f,onLocationSelect:p}}),(0,r.useEffect)(()=>{if(!b.current||v.current)return;let t=!0;return e.A(71400).then(e=>{if(!t||!b.current)return;let{center:r,zoom:n,interactive:l,isPicker:i,pickerCoords:a,pickerLat:o,pickerLng:s}=C.current,c=a||(o&&s?{lat:o,lng:s}:null),u=c?[c.lat,c.lng]:r,d=e.map(b.current,{center:u,zoom:n,zoomControl:l,dragging:l,scrollWheelZoom:l,doubleClickZoom:l,attributionControl:!0});e.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',maxZoom:19}).addTo(d),v.current=d,z(!0),setTimeout(()=>{v.current&&v.current.invalidateSize()},250),i&&d.on("click",e=>{C.current.onLocationPick&&C.current.onLocationPick({lat:e.latlng.lat,lng:e.latlng.lng}),C.current.onLocationSelect&&C.current.onLocationSelect(e.latlng.lat,e.latlng.lng)})}),()=>{t=!1,v.current&&(v.current.remove(),v.current=null)}},[]),(0,r.useEffect)(()=>{if(!b.current)return;let e=new ResizeObserver(()=>{v.current&&v.current.invalidateSize()});return e.observe(b.current),()=>{e.disconnect()}},[]),(0,r.useEffect)(()=>{j&&v.current&&h&&2===h.length&&v.current.setView(h,m,{animate:!0})},[h,j,m]),(0,r.useEffect)(()=>{j&&v.current&&!s&&e.A(71400).then(e=>{let t=v.current;if(!t)return;Object.values(w.current).forEach(e=>e.remove()),w.current={};let r=e.latLngBounds([]);l.forEach(n=>{if(!n.latitude||!n.longitude)return;let l=n.status?.toLowerCase()==="resolved",s=n.priority?.toLowerCase(),c="#2563eb",u="rgba(37, 99, 235, 0.3)";l?(c="#64748b",u="rgba(100, 116, 139, 0.2)"):"critical"===s?(c="#dc2626",u="rgba(220, 38, 38, 0.4)"):"high"===s?(c="#ea580c",u="rgba(234, 88, 12, 0.4)"):"medium"===s?(c="#ca8a04",u="rgba(202, 138, 4, 0.3)"):"low"===s&&(c="#16a34a",u="rgba(22, 163, 74, 0.3)");let d=i===n.id,f=n.complaint_count||1,p=Math.min(46,Math.max(32,28+4*Math.log2(f))),g=`
          <div style="
            width: ${p}px;
            height: ${p}px;
            border-radius: 50%;
            background: ${c};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 800;
            box-shadow: 0 4px 14px ${u}, 0 2px 4px rgba(0,0,0,0.25);
            border: ${d?"3px solid #ffffff":"2px solid #ffffff"};
            transform: ${d?"scale(1.2)":"scale(1)"};
            transition: all 0.2s ease;
            cursor: pointer;
          ">
            ${f>1?f:"!"}
          </div>
        `,m=e.divIcon({className:"custom-civic-marker",html:g,iconSize:[p,p],iconAnchor:[p/2,p/2]}),h=e.marker([n.latitude,n.longitude],{icon:m}).addTo(t);h.on("click",()=>{a&&a(n.id),o&&o(n)}),h.bindTooltip(`
          <div style="font-family: inherit; padding: 4px 6px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">
              Issue #${n.id} • ${n.department||"General"}
            </div>
            <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">
              ${n.title}
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              ${n.complaint_count||1} citizen report${(n.complaint_count||1)>1?"s":""} • ${n.priority} Priority
            </div>
          </div>
        `,{direction:"top",offset:[0,-p/2]}),w.current[n.id]=h,r.extend([n.latitude,n.longitude])}),r.isValid()&&l.length>0&&!i&&t.fitBounds(r,{padding:[50,50],maxZoom:15})})},[j,l,i,s,o,a]),(0,r.useEffect)(()=>{if(!j||!v.current)return;let t=v.current;if(k.current&&(k.current.remove(),k.current=null),!i)return;let r=l.find(e=>e.id===i);return r&&r.latitude&&r.longitude&&(t.flyTo([r.latitude,r.longitude],15,{duration:1}),e.A(71400).then(e=>{if(!v.current)return;k.current&&k.current.remove();let t=e.circle([r.latitude,r.longitude],{radius:1e3,color:"#2563eb",fillColor:"#3b82f6",fillOpacity:.12,weight:1.5,dashArray:"4, 6"}).addTo(v.current);t.bindTooltip(`<div style="font-family: inherit; font-size: 11px; font-weight: 700; color: #1e40af;">
            City Memory Catchment (1.0 km)
           </div>`,{permanent:!1,direction:"center"}),k.current=t})),()=>{k.current&&(k.current.remove(),k.current=null)}},[j,i,l]),(0,r.useEffect)(()=>{j&&v.current&&s&&e.A(71400).then(e=>{let t=v.current;if(!t)return;y.current&&(y.current.remove(),y.current=null);let r=c||(u&&d?{lat:u,lng:d}:null);if(r){let n=`
          <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <svg width="36" height="44" viewBox="0 0 36 44" fill="none" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
              <path d="M18 0C8.059 0 0 8.059 0 18C0 31.5 18 44 18 44C18 44 36 31.5 36 18C36 8.059 27.941 0 18 0Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
              <circle cx="18" cy="18" r="6" fill="#ffffff"/>
            </svg>
          </div>
        `,l=e.divIcon({className:"custom-picker-pin",html:n,iconSize:[36,44],iconAnchor:[18,44],popupAnchor:[0,-44]}),i=e.marker([r.lat,r.lng],{icon:l,draggable:!0}).addTo(t);i.on("dragend",e=>{let t=e.target.getLatLng();f&&f({lat:t.lat,lng:t.lng}),p&&p(t.lat,t.lng)}),y.current=i,t.panTo([r.lat,r.lng])}})},[j,c,u,d,s,f,p]);let N="100%"===g;return(0,t.jsxs)("div",{className:`relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100 ${N?"h-full min-h-[400px]":""}`,style:{height:g,minHeight:N?"100%":g},children:[(0,t.jsx)("div",{ref:b,style:{width:"100%",height:"100%",minHeight:N?"400px":g},className:"z-10"}),!s&&(0,t.jsxs)("div",{className:"absolute bottom-3 right-3 z-20 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md text-[11px] flex items-center gap-3",children:[(0,t.jsx)("span",{className:"font-semibold text-slate-700",children:"Priority:"}),(0,t.jsxs)("span",{className:"flex items-center gap-1 text-slate-600",children:[(0,t.jsx)("span",{className:"w-2.5 h-2.5 rounded-full bg-red-600"})," Critical"]}),(0,t.jsxs)("span",{className:"flex items-center gap-1 text-slate-600",children:[(0,t.jsx)("span",{className:"w-2.5 h-2.5 rounded-full bg-orange-500"})," High"]}),(0,t.jsxs)("span",{className:"flex items-center gap-1 text-slate-600",children:[(0,t.jsx)("span",{className:"w-2.5 h-2.5 rounded-full bg-yellow-500"})," Medium"]}),(0,t.jsxs)("span",{className:"flex items-center gap-1 text-slate-600",children:[(0,t.jsx)("span",{className:"w-2.5 h-2.5 rounded-full bg-emerald-500"})," Low"]}),(0,t.jsxs)("span",{className:"flex items-center gap-1 text-slate-600",children:[(0,t.jsx)("span",{className:"w-2.5 h-2.5 rounded-full bg-slate-400"})," Resolved"]})]})]})}])},9368,function(e){e.n(e.i(85849))}]);