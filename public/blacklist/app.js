const $=id=>document.getElementById(id);
let db=null,kind="all",source="all",visible=35,query="";
const fmt=n=>new Intl.NumberFormat("vi-VN").format(n);
const origin={mew:"MyEtherWallet",etherscamdb:"EtherScamDB"};
const links={mew:"https://github.com/MyEtherWallet/ethereum-lists/blob/master/src/addresses/addresses-darklist.json",etherscamdb:"https://github.com/CryptoScamDB/EtherScamDB/blob/master/_data/scams.yaml"};
const addressRE=/^0x[a-f0-9]{40}$/i;
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node};
function normalize(value){
 let s=String(value||"").trim().toLowerCase();if(!s)return "";
 const addr=s.match(/0x[a-f0-9]{40}/i);
 if(addr && (addressRE.test(s)||/^(https?:\/\/)?[^\s]+\/address\/0x/i.test(s)))return addr[0].toLowerCase();
 if(/^https?:\/\//i.test(s)){try{return new URL(s).hostname.toLowerCase().replace(/\.$/,"")}catch{}}
 return s.replace(/\/$/,"").replace(/^www\./,"");
}
function createResult(x,type){
 const card=el("article","item"),top=el("div","item-top"),name=el("strong","item-title",x.value),badges=el("div","pills");
 badges.append(el("span","pill",type==="address"?"Địa chỉ 0x":"Tên miền"));
 for(const s of x.sources)badges.append(el("span","pill source",origin[s]||s));
 top.append(name,badges);card.append(top);
 const summary=el("p","item-summary",x.reports.length+" thông tin dẫn nguồn được lưu trong bản chụp. Mục có báo cáo không đồng nghĩa đã được xác minh là gian lận.");
 card.append(summary);
 const ul=el("ul","evidence");
 for(const r of x.reports.slice(0,3)){const label=(origin[r.source]||r.source)+(r.id?" · Mục #"+r.id:"")+(r.category?" · "+r.category:"")+(r.date?" · "+r.date:"");let note=(r.note||r.name||"Báo cáo cộng đồng").slice(0,220);ul.append(el("li","",label+" — "+note));}
 card.append(ul);
 const acts=el("div","item-actions");
 for(const s of x.sources){const a=el("a","", "Xem nguồn "+origin[s]+" ↗");a.href=links[s];a.rel="noopener noreferrer";a.target="_blank";acts.append(a);}
 if(type==="address"){const a=el("a","","Phân tích hợp đồng trong QuickScan ↗");a.href="../scanner/?chain=1&address="+encodeURIComponent(x.value);acts.append(a);}
 card.append(acts);return card;
}
function selectRecords(){
 if(!db)return [];
 const wanted=kind==="address"?[[db.addresses,"address"]]:kind==="domain"?[[db.domains,"domain"]]:[[db.addresses,"address"],[db.domains,"domain"]];
 const out=[];
 for(const [rows,type] of wanted){for(const r of rows){if(source!=="all"&&!r.sources.includes(source))continue;
 const searchText=[r.value,...r.reports.map(y=>(y.name||"")+" "+(y.category||"")+" "+(y.note||""))].join(" ").toLowerCase();
 if(query&&!searchText.includes(query))continue;
 out.push({row:r,type});}}
 if(query && (addressRE.test(query)||query.includes(".")))out.sort((a,b)=>(a.row.value===query?-1:0)-(b.row.value===query?-1:0));
 return out;
}
function draw(){
 if(!db)return;const found=selectRecords(),target=$("results");target.replaceChildren();
 const rows=found.slice(0,visible);
 if(!rows.length)target.append(el("div","none",query?"Không có mục trùng khớp trong bản dữ liệu này. Điều đó KHÔNG chứng minh đối tượng an toàn.":"Không có mục nào cho bộ lọc đã chọn."));
 else for(const r of rows)target.append(createResult(r.row,r.type));
 $("summary").textContent=fmt(found.length)+" đối tượng phù hợp"+(rows.length<found.length?" · đang hiển thị "+fmt(rows.length):"")+".";
 $("more").hidden=rows.length>=found.length;
}
function search(){query=normalize($("query").value);visible=35;draw();}
$("form").addEventListener("submit",e=>{e.preventDefault();search();$("database").scrollIntoView({behavior:"smooth",block:"start"});});
$("query").addEventListener("input",()=>{search()});
document.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>{kind=b.dataset.type;visible=35;document.querySelectorAll("[data-type]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));draw();}));
$("sourceFilter").addEventListener("change",e=>{source=e.target.value;visible=35;draw();});
$("more").addEventListener("click",()=>{visible+=50;draw()});
const preset=new URLSearchParams(location.search).get("address")||new URLSearchParams(location.search).get("q");
if(preset){$("query").value=preset;}
(async()=>{
 try{const res=await fetch("./data.json",{cache:"no-store"});if(!res.ok)throw Error("HTTP "+res.status);
 const json=await res.json();if(!Array.isArray(json.addresses)||!Array.isArray(json.domains)||!json.metadata?.counts)throw Error("Dữ liệu không hợp lệ");
 db=json;$("addressCount").textContent=fmt(db.metadata.counts.addresses);$("domainCount").textContent=fmt(db.metadata.counts.domains);
 $("sourceCount").textContent=fmt(db.metadata.counts.mewRecords)+" / "+fmt(db.metadata.counts.etherScamReports);
 $("asOf").textContent=db.metadata.generatedAt;
 $("loadState").textContent="DỮ LIỆU ĐÃ TẢI";search();
 }catch(e){$("loadState").textContent="LỖI TẢI";$("summary").textContent="Không tải được bản dữ liệu: "+String(e.message||e)+". Không thể kết luận địa chỉ an toàn khi tra cứu thất bại."; }
})();