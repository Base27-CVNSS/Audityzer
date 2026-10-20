import {NETWORKS,parseTarget,analyzeSources,riskSummary,normalizeSourcify,normalizeBlockscout} from "./engine.mjs";
const $ = id => document.getElementById(id);
const SEVERITY = {critical:"Nghiêm trọng",high:"Cao",medium:"Trung bình",low:"Thấp",unknown:"Chưa đủ dữ liệu"};
const CLEAN = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const scanner = {report:null,activeFilter:"all",busy:false};
const input = $("contractInput");
const chainPicker = $("chainSelect");
NETWORKS.forEach(c => {
  const opt = document.createElement("option");
  opt.value = c.id; opt.textContent = c.name; chainPicker.appendChild(opt);
});
function setStatus(message,error=false) {
  $("message").textContent=error ? message : "";
  $("loading").classList.toggle("active",Boolean(message && !error));
  $("loadingText").textContent=message || "";
  $("scanButton").disabled=Boolean(message && !error);
  scanner.busy=Boolean(message && !error);
}
function setMessage(message) { $("message").textContent=message; }
async function fetchJson(url) {
  const abort = new AbortController(), timeout = setTimeout(()=>abort.abort(),13500);
  try {
    const response = await fetch(url,{signal:abort.signal,headers:{Accept:"application/json"}});
    if (!response.ok) return {data:null,error:"HTTP "+response.status};
    return {data:await response.json(),error:null};
  } catch (e) {
    return {data:null,error:e?.name==="AbortError" ? "quá thời gian" : "không thể truy cập (CORS / mạng)"};
  } finally { clearTimeout(timeout); }
}
async function lookupOne(chain,address) {
  const failures=[];
  const api="https://sourcify.dev/server/v2/contract/"+chain.id+"/"+address+"?fields=abi,sources,compilation,proxyResolution";
  const sourcify = await fetchJson(api);
  if (sourcify.data) {
    const normalized=normalizeSourcify(sourcify.data);
    if (Object.keys(normalized.sourceFiles).length) return {data:normalized,failures};
  } else if (sourcify.error && sourcify.error!=="HTTP 404") failures.push("Sourcify: "+sourcify.error);
  if (chain.blockscout) {
    const blockscout = await fetchJson(chain.blockscout+"/api/v2/smart-contracts/"+address);
    if (blockscout.data) {
      const normalized=normalizeBlockscout(blockscout.data);
      if (normalized.verified || normalized.abi.length) return {data:normalized,failures};
    } else if (blockscout.error && blockscout.error!=="HTTP 404") failures.push("Blockscout: "+blockscout.error);
  }
  if (sourcify.data) return {data:normalizeSourcify(sourcify.data),failures};
  return {data:null,failures};
}
async function scan(chain,address) {
  const primary=await lookupOne(chain,address);
  let data=primary.data;
  const failures=[...primary.failures];
  let implementationAnalyzed=false;
  if (data?.proxy?.isProxy && data.proxy.implementations.length) {
    const first = data.proxy.implementations.find(x=>x.toLowerCase()!==address.toLowerCase());
    if (first) {
      setStatus("Đang kiểm tra mã nguồn implementation proxy…");
      const secondary=await lookupOne(chain,first);
      failures.push(...secondary.failures.map(x=>"Implementation "+x));
      if (secondary.data?.verified && Object.keys(secondary.data.sourceFiles).length) {
        const mapped=Object.fromEntries(Object.entries(secondary.data.sourceFiles).map(([path,src])=>["implementation/"+path,src]));
        data.sourceFiles={...data.sourceFiles,...mapped};
        data.abi=secondary.data.abi.length ? secondary.data.abi : data.abi;
        implementationAnalyzed=true;
      }
    }
  }
  const analysis=analyzeSources(data?.sourceFiles || {},data?.abi || []);
  const risk=riskSummary(analysis.findings,analysis.coverage,data?.proxy);
  return {
    scannedAt:new Date().toISOString(), chain:{id:chain.id,name:chain.name},
    address, name:data?.name || "Không xác định", provider:data?.provider || "Không có nguồn xác minh",
    verified:Boolean(data?.verified), proxy:data?.proxy || {isProxy:false,implementations:[]},
    implementationAnalyzed, coverage:analysis.coverage, files:analysis.files,
    functions:analysis.functions, analyzedFunctions:analysis.analyzedFunctions,
    findings:analysis.findings, risk, apiWarnings:failures
  };
}
function infoText(report) {
  if (report.coverage==="verified-source") return "Đã đọc "+report.files+" file đã công bố · rà soát "+report.analyzedFunctions+" khai báo hàm";
  if (report.coverage==="abi-only") return "Chỉ có ABI; tín hiệu từ tên hàm, chưa kiểm tra phần thân";
  return "Không lấy được source/ABI; không thể xác định hợp đồng an toàn hay nguy hiểm";
}
function renderFindings() {
  const report=scanner.report;
  const selected=scanner.activeFilter;
  const findings=report.findings.filter(f=>selected==="all" || f.severity===selected);
  $("findingList").innerHTML = findings.length ? findings.map(f=>{
    const where = f.basis==="source" ? CLEAN(f.file)+" : dòng "+f.line : "Chỉ dấu từ ABI";
    return '<article class="finding '+CLEAN(f.severity)+'"><div class="finding-head"><span class="tag '+CLEAN(f.severity)+'">'+SEVERITY[f.severity]+'</span><h3>'+CLEAN(f.title)+'</h3></div>'
      +'<p>'+CLEAN(f.why)+'</p><p><code>'+CLEAN(f.signature)+'</code></p><div class="finding-foot"><span>▸ '+where+'</span><span>Hàm: '+CLEAN(f.functionName)+'</span></div>'
      +'<p class="muted" style="margin-bottom:0"><strong>Vị trí:</strong> <code>'+CLEAN(f.evidence)+'</code></p></article>';
  }).join("") : '<div class="empty">'+(report.coverage==="none" ? "Không có mã nguồn xác minh hoặc ABI để phân tích. Không thể kết luận mức độ an toàn." : "Không có cảnh báo trong bộ lọc này. Điều đó không chứng minh hợp đồng an toàn.")+'</div>';
  document.querySelectorAll(".filter").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.level===selected)));
}
function render(report) {
  scanner.report=report;scanner.activeFilter="all";
  $("results").classList.add("visible");
  $("introStats").style.display="none";
  $("scanTime").textContent="THỜI ĐIỂM QUÉT: "+new Date(report.scannedAt).toLocaleString("vi-VN");
  $("contractName").textContent=report.name;
  $("contractNetwork").textContent=report.chain.name+" · Chain ID "+report.chain.id;
  $("contractAddress").textContent=report.address;
  $("contractVerified").textContent=report.verified ? "✓ Có mã nguồn công khai đã xác minh" : "⚠ Chưa có mã nguồn được xác minh";
  $("contractVerified").className=report.verified ? "status-ok" : "status-warn";
  $("contractProvider").textContent=report.provider;
  $("coverage").textContent=infoText(report);
  $("proxyInfo").textContent=report.proxy.isProxy
    ? "Có · "+(report.proxy.type || "Proxy")+(report.proxy.implementations.length ? " · "+report.proxy.implementations.join(", ") : "")+(report.implementationAnalyzed ? " · Đã đọc implementation" : " · Chưa xác minh implementation")
    : "Không phát hiện theo dữ liệu hiện có";
  $("functionStats").textContent=report.analyzedFunctions+" khai báo hàm / "+report.files+" file; "+report.functions.length+" hàm ABI";
  const score=report.risk.score;
  const level=score===null ? "unknown" : report.risk.level;
  $("scoreNumber").textContent=score===null?"?":score;
  $("scoreTag").className="tag "+level;
  $("scoreTag").textContent=SEVERITY[level];
  $("scoreText").textContent=report.risk.text;
  $("scoreHint").textContent=(report.coverage==="abi-only" ? "Chỉ số sơ bộ từ ABI, độ tin cậy thấp." : "Chỉ số dựa trên quy tắc; không phải điểm chứng nhận an toàn.")+(report.proxy.isProxy ? " Có proxy, logic có thể thay đổi." : "");
  const hue={critical:"#ff5c72",high:"#ff8258",medium:"#ffb453",low:"#3de4bc",unknown:"#506078"}[level];
  $("scoreRing").style.setProperty("--ring",hue);
  $("scoreRing").style.setProperty("--score",score===null?0:score);
  $("highCount").textContent=report.findings.filter(x=>["critical","high"].includes(x.severity)).length;
  $("otherCount").textContent=report.findings.filter(x=>["medium","low"].includes(x.severity)).length;
  $("totalCount").textContent=report.findings.length;
  const network=NETWORKS.find(c=>c.id===report.chain.id);
  $("explorerLink").href=network.explorer+"/address/"+report.address+"#code";
  renderFindings();
  if (report.apiWarnings.length) {
    setMessage("Một số dịch vụ chưa phản hồi: "+report.apiWarnings.join(" · ")+". Kết quả có thể chưa đầy đủ.");
  } else if (report.coverage==="none") {
    setMessage("Chưa tìm thấy mã nguồn công khai cho địa chỉ này trên mạng đã chọn. Kiểm tra lại chain và địa chỉ. Không thể kết luận an toàn.");
  }
}
$("scanForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(scanner.busy)return;
  $("message").textContent="";
  let target;
  try {target=parseTarget(input.value,chainPicker.value);} catch(e){setMessage(e.message);return;}
  const chain=NETWORKS.find(n=>n.id===target.chainId);
  if(!chain){setMessage("Mạng blockchain chưa được hỗ trợ.");return;}
  chainPicker.value=String(chain.id);
  input.value=target.address;
  $("results").classList.remove("visible");
  setStatus("Đang tra cứu mã nguồn đã xác minh trên Sourcify / Blockscout…");
  try {
    const report=await scan(chain,target.address);
    setStatus("");
    window.history.replaceState(null,"",location.pathname+"?chain="+chain.id+"&address="+encodeURIComponent(target.address));
    render(report);
    $("results").scrollIntoView({behavior:"smooth",block:"start"});
  } catch(e) {
    setStatus("");
    setMessage("Không thể hoàn tất phiên quét. "+(e?.message || "Lỗi không xác định")+". Vui lòng thử lại.");
  }
});
$("filters").addEventListener("click",event=>{
  const button=event.target.closest("button[data-level]");
  if(button && scanner.report){scanner.activeFilter=button.dataset.level;renderFindings();}
});
$("copyButton").addEventListener("click",async()=>{
  if(!scanner.report)return;
  try{await navigator.clipboard.writeText(scanner.report.address);$("copyButton").textContent="✓ Đã sao chép";}
  catch{setMessage("Trình duyệt chặn clipboard; hãy chọn và sao chép địa chỉ hiển thị.");}
});
$("shareButton").addEventListener("click",async()=>{
  if(!scanner.report)return;
  try{await navigator.clipboard.writeText(location.href);$("shareButton").textContent="✓ Đã sao chép";}
  catch{setMessage("Trình duyệt chặn clipboard; hãy sao chép URL trên thanh địa chỉ.");}
});
$("exportButton").addEventListener("click",()=>{
  if(!scanner.report)return;
  const file=new Blob([JSON.stringify(scanner.report,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(file);const a=document.createElement("a");
  a.href=url;a.download="audityzer-"+scanner.report.chain.id+"-"+scanner.report.address.slice(0,10)+".json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
});
$("exampleButton").addEventListener("click",()=>{
  chainPicker.value="1";
  input.value="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  $("scanForm").requestSubmit();
});
const params=new URLSearchParams(location.search);
const address=params.get("address"),chain=params.get("chain");
if(address && NETWORKS.some(n=>n.id===Number(chain))) {
  chainPicker.value=chain;input.value=address;
  $("scanForm").requestSubmit();
}
