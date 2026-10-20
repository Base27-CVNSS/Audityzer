/**
 * Audityzer QuickScan — deterministic client-side triage.
 * No claim of formal audit, exploit proof, honeypot simulation or Slither execution.
 * No secret keys required. All findings cite inspected verified source text or ABI.
 */
export const NETWORKS = [
  {id:1, name:"Ethereum", explorer:"https://etherscan.io", blockscout:"https://eth.blockscout.com"},
  {id:56, name:"BNB Chain", explorer:"https://bscscan.com", blockscout:null},
  {id:137, name:"Polygon", explorer:"https://polygonscan.com", blockscout:"https://polygon.blockscout.com"},
  {id:42161, name:"Arbitrum", explorer:"https://arbiscan.io", blockscout:"https://arbitrum.blockscout.com"},
  {id:10, name:"Optimism", explorer:"https://optimistic.etherscan.io", blockscout:"https://optimism.blockscout.com"},
  {id:8453, name:"Base", explorer:"https://basescan.org", blockscout:"https://base.blockscout.com"},
  {id:100, name:"Gnosis", explorer:"https://gnosisscan.io", blockscout:"https://gnosis.blockscout.com"},
  {id:43114, name:"Avalanche C-Chain", explorer:"https://snowtrace.io", blockscout:null}
];
const HOST_TO_CHAIN = new Map([
  ["etherscan.io",1],["eth.blockscout.com",1],
  ["bscscan.com",56],["polygonscan.com",137],["polygon.blockscout.com",137],
  ["arbiscan.io",42161],["arbitrum.blockscout.com",42161],
  ["optimistic.etherscan.io",10],["optimism.blockscout.com",10],
  ["basescan.org",8453],["base.blockscout.com",8453],
  ["gnosisscan.io",100],["gnosis.blockscout.com",100],
  ["snowtrace.io",43114]
]);
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
export function parseTarget(value, selectedChain = 1) {
  const raw = String(value || "").trim();
  if (ADDRESS.test(raw)) return {address:raw, chainId:Number(selectedChain)};
  if (!/^https?:\/\//i.test(raw)) throw new Error("Nhập địa chỉ 0x gồm 40 ký tự hex hoặc URL trang explorer hợp lệ.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("URL không hợp lệ."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Chỉ nhận URL HTTP/HTTPS.");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const chainId = HOST_TO_CHAIN.get(host);
  if (!chainId) throw new Error("Explorer này chưa được hỗ trợ. Hãy dán riêng địa chỉ 0x và chọn mạng.");
  const match = url.pathname.match(/\/(?:address|token|contract)\/(0x[a-fA-F0-9]{40})(?:\/|$)/i);
  if (!match) throw new Error("Không tìm thấy địa chỉ hợp đồng trong đường dẫn explorer.");
  return {address:match[1],chainId};
}
export function stripComments(source) {
  return String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, part => part.replace(/[^\n]/g," "))
    .replace(/\/\/[^\n]*/g, part => " ".repeat(part.length));
}
export function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}
export function extractFunctions(source) {
  const cleaned = stripComments(source);
  const found = [];
  const re = /\bfunction\s+([A-Za-z_]\w*)\s*\(|\bconstructor\s*\(/g;
  let match;
  while ((match = re.exec(cleaned)) !== null) {
    const start = match.index;
    const name = match[1] || "constructor";
    const brace = cleaned.indexOf("{", re.lastIndex);
    const semicolon = cleaned.indexOf(";", re.lastIndex);
    if (brace < 0 || (semicolon >= 0 && semicolon < brace)) continue;
    // Bound the signature to avoid borrowing the next function's opening brace.
    if (brace - start > 1200) continue;
    let depth = 0, end = brace;
    for (let i = brace; i < cleaned.length; i++) {
      if (cleaned[i] === "{") depth++;
      if (cleaned[i] === "}" && --depth === 0 && cleaned[i] === "}") { end = i + 1; break; }
    }
    if (end <= brace) continue;
    found.push({
      name, start, line:lineNumber(source,start),
      signature:cleaned.slice(start,brace).replace(/\s+/g," ").trim().slice(0,240),
      body:cleaned.slice(brace,end), original:source.slice(start,end)
    });
    re.lastIndex = end;
  }
  return found;
}
const CAPABILITIES = [
  {id:"selfdestruct",severity:"critical",title:"Có cơ chế hủy hợp đồng",why:"SELFDESTRUCT có thể ảnh hưởng kiến trúc hoặc hành vi tùy phiên bản EVM; cần kiểm tra ngữ cảnh và quyền gọi.",pattern:/\bselfdestruct\s*\(/i},
  {id:"delegatecall",severity:"high",title:"Lời gọi delegatecall",why:"Mã khác có thể chạy trong ngữ cảnh lưu trữ của hợp đồng. Cần kiểm tra địa chỉ đích và kiểm soát truy cập.",pattern:/\.delegatecall\s*\(/i},
  {id:"tx-origin",severity:"high",title:"Dùng tx.origin",why:"tx.origin trong logic xác thực có nguy cơ bị lợi dụng qua lời gọi trung gian.",pattern:/\btx\.origin\b/i},
  {id:"assembly",severity:"medium",title:"Sử dụng assembly",why:"Assembly cần kiểm toán thủ công về bộ nhớ, phép gọi và tính đúng đắn.",pattern:/\bassembly\s*\{/i},
  {id:"unchecked",severity:"low",title:"Khối unchecked",why:"Các phép toán trong unchecked bỏ kiểm tra overflow mặc định của Solidity 0.8+.",pattern:/\bunchecked\s*\{/i},
  {id:"external-call",severity:"medium",title:"Gọi ETH qua low-level call",why:"Cần kiểm tra thứ tự effects/interactions, xử lý kết quả và chặn reentrancy; đây chưa phải bằng chứng lỗ hổng.",pattern:/\.call\s*\{[^}]*value\s*:/i},
  {id:"owner-mint",severity:"high",title:"Khả năng phát hành thêm token",why:"Nếu quyền mint không bị giới hạn, nguồn cung có thể thay đổi; cần kiểm tra role, cap và trạng thái hiện tại.",name:/^(mint|issue|mintTo|bridgeMint|adminMint)$/i},
  {id:"blacklist",severity:"high",title:"Kiểm soát blacklist / whitelist",why:"Quyền giới hạn địa chỉ có thể ảnh hưởng việc chuyển hoặc bán token.",name:/(blacklist|blocklist|setBlacklist|setWhitelist|excludeFromFees)/i},
  {id:"tax",severity:"high",title:"Thay đổi thuế / phí giao dịch",why:"Chủ thể có quyền chỉnh mức phí có thể khiến giao dịch không kinh tế hoặc khó bán.",name:/(set.*(tax|fee)|update.*(tax|fee)|change.*(tax|fee))/i},
  {id:"trading",severity:"high",title:"Bật/tắt hoặc hạn chế giao dịch",why:"Cơ chế trading hoặc giới hạn giao dịch có thể cản trở chuyển token.",name:/(enableTrading|disableTrading|setTrading|setMaxTx|setMaxWallet|setTransferLimit|setCooldown)/i},
  {id:"upgrade",severity:"high",title:"Nâng cấp implementation",why:"Logic hợp đồng có thể thay đổi nếu quyền nâng cấp còn hoạt động.",name:/(upgradeTo|upgradeToAndCall|setImplementation|_authorizeUpgrade)/i},
  {id:"withdraw",severity:"medium",title:"Rút tài sản / cứu hộ token",why:"Chức năng chuyển tài sản khỏi hợp đồng cần kiểm tra điều kiện, đích nhận và quyền gọi.",name:/(withdraw|rescue|sweep|recoverToken|emergencyWithdraw|drain)/i},
  {id:"pause",severity:"medium",title:"Tạm dừng hoạt động",why:"Quyền pause có thể làm gián đoạn chuyển token hoặc hoạt động của giao thức.",name:/(^pause$|^unpause$|setPaused)/i},
  {id:"owner-transfer",severity:"medium",title:"Thay đổi quản trị",why:"Cần xác minh owner/admin, timelock và đa chữ ký thực tế.",name:/(transferOwnership|grantRole|revokeRole|setOwner|setAdmin)/i}
];
const SEVERITY_WEIGHT = {critical:32,high:18,medium:8,low:3};
export function analyzeSources(sourceFiles, abi = []) {
  const files = Object.entries(sourceFiles || {})
    .filter(([name,src]) => typeof src === "string" && src.length)
    .map(([name,src]) => ({name,src,functions:extractFunctions(src)}));
  const findings = [];
  const seen = new Set();
  function add(f) {
    const key = [f.rule,f.file,f.line,f.functionName].join("|");
    if (!seen.has(key)) { seen.add(key); findings.push(f); }
  }
  for (const file of files) {
    for (const fn of file.functions) {
      for (const rule of CAPABILITIES) {
        const nameHit = rule.name && rule.name.test(fn.name);
        const bodyHit = rule.pattern && rule.pattern.test(fn.body);
        if (!nameHit && !bodyHit) continue;
        const within = bodyHit ? fn.body.search(rule.pattern) : 0;
        const offset = bodyHit ? fn.start + fn.original.indexOf("{") + Math.max(0,within) : fn.start;
        const line = lineNumber(file.src,Math.max(0,offset));
        add({rule:rule.id,severity:rule.severity,title:rule.title,why:rule.why,
          file:file.name,line,functionName:fn.name,signature:fn.signature,
          evidence:file.src.split("\n")[line-1]?.trim().slice(0,200) || fn.signature,
          basis:"source"});
      }
    }
  }
  // ABI metadata is informative, not proof of unsafe implementation.
  const functions = Array.isArray(abi) ? abi.filter(x=>x && x.type === "function").map(x=>({
    name:String(x.name || "(ẩn danh)"),
    signature:String(x.name || "") + "(" + (x.inputs || []).map(i=>i.type || "?").join(",") + ")",
    mutability:x.stateMutability || "nonpayable"
  })) : [];
  const abiWarnings = [];
  if (!files.length) {
    for (const entry of functions) {
      for (const rule of CAPABILITIES.filter(x=>x.name)) {
        if (rule.name.test(entry.name)) abiWarnings.push({
          rule:rule.id,severity:rule.severity,title:rule.title,
          why:"Chỉ nhận diện tên hàm từ ABI; chưa thấy logic triển khai để khẳng định hành vi.",
          file:"ABI",line:null,functionName:entry.name,signature:entry.signature,evidence:entry.signature,basis:"abi"
        });
      }
    }
  }
  findings.sort((a,b)=>SEVERITY_WEIGHT[b.severity]-SEVERITY_WEIGHT[a.severity]);
  return {findings:files.length ? findings : abiWarnings,
    files:files.length,functions,analyzedFunctions:files.reduce((sum,f)=>sum+f.functions.length,0),
    coverage:files.length ? "verified-source" : (functions.length ? "abi-only" : "none")};
}
export function riskSummary(findings, coverage, proxy) {
  if (coverage === "none") return {score:null,level:"unknown",text:"Chưa đủ dữ liệu"};
  const unique = new Set();
  let total = 0;
  for (const f of findings) {
    const key = f.rule + "|" + f.functionName;
    if (unique.has(key)) continue;
    unique.add(key);
    total += SEVERITY_WEIGHT[f.severity] || 0;
  }
  if (proxy?.isProxy) total += 12;
  const score = Math.min(100,findings.some(f=>f.severity === "critical") ? Math.max(75,total) : total);
  return {score,level:score >= 70 ? "critical" : score >= 35 ? "high" : score >= 15 ? "medium" : "low",
    text:score >= 70 ? "Nhiều dấu hiệu cần kiểm tra" : score >= 35 ? "Rủi ro cần xem xét" : score >= 15 ? "Có quyền nhạy cảm" : "Ít tín hiệu theo bộ quy tắc"};
}
export function normalizeSourcify(json) {
  const sources = {};
  for (const [path,item] of Object.entries(json?.sources || {})) {
    if (typeof item?.content === "string") sources[path] = item.content;
  }
  return {name:json?.compilation?.name || "Hợp đồng đã xác minh",sourceFiles:sources,
    abi:Array.isArray(json?.abi) ? json.abi : [],verified:true,provider:"Sourcify v2",
    proxy:json?.proxyResolution?.isProxy ? {
      isProxy:true,type:json.proxyResolution.proxyType || "Proxy",
      implementations:(json.proxyResolution.implementations || []).map(x=>x.address).filter(x=>ADDRESS.test(x))
    } : {isProxy:false,implementations:[]}};
}
export function normalizeBlockscout(json) {
  const sources={};
  if (typeof json?.source_code === "string" && json.source_code.length) sources[json.file_path || (json.name || "Contract") + ".sol"]=json.source_code;
  for (const file of json?.additional_sources || []) if (typeof file?.source_code === "string") sources[file.file_path || "Additional.sol"]=file.source_code;
  const impl=json?.implementations || [];
  return {name:json?.name || "Hợp đồng đã xác minh",sourceFiles:sources,
    abi:Array.isArray(json?.abi) ? json.abi : [],verified:Object.keys(sources).length>0,
    provider:"Blockscout",proxy:{
      isProxy:Boolean(json?.is_proxy || impl.length || json?.implementation_address),
      type:"Proxy",implementations:[...impl.map(x=>x.address_hash || x.address).filter(x=>ADDRESS.test(x)),
        ...(ADDRESS.test(json?.implementation_address) ? [json.implementation_address] : [])]
    }};
}
export function fileCounts(findings) {
  return ["critical","high","medium","low"].map(severity=>({severity,count:findings.filter(f=>f.severity===severity).length}));
}
