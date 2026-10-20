import {test} from "node:test";
import assert from "node:assert/strict";
import {parseTarget,stripComments,extractFunctions,analyzeSources,riskSummary,normalizeSourcify,normalizeBlockscout} from "../public/scanner/engine.mjs";

const A="0x"+"a".repeat(40);
test("accept bare address with selected chain",()=>assert.deepEqual(parseTarget(A,8453),{address:A,chainId:8453}));
test("detect chain from trusted explorer URL",()=>assert.equal(parseTarget("https://basescan.org/address/"+A).chainId,8453));
test("accept Blockscout token URL",()=>assert.equal(parseTarget("https://eth.blockscout.com/token/"+A).chainId,1));
test("reject arbitrary host even if it embeds a plausible path",()=>assert.throws(()=>parseTarget("https://evil.tld/address/"+A)));
test("reject invalid address and transaction hash",()=>assert.throws(()=>parseTarget("0x1234")));
test("ignore comments",()=>assert.equal(stripComments("// function hack() {}\ncontract T{}").includes("hack"),false));
test("extract Solidity functions",()=>{
  const funcs=extractFunctions("contract T { function mint(address to) external { _mint(to,1); } function f() public view returns(uint){ return 1; } }");
  assert.deepEqual(funcs.map(x=>x.name),["mint","f"]);
});
test("source findings cite real function and line",()=>{
  const source="contract Token {\nfunction setTax(uint256 x) external onlyOwner { fee=x; }\nfunction sell() external {}\n}";
  const r=analyzeSources({"Token.sol":source});
  const f=r.findings.find(x=>x.rule==="tax");
  assert.equal(f.functionName,"setTax");assert.equal(f.line,2);assert.equal(f.file,"Token.sol");
  assert.ok(!r.findings.some(x=>x.functionName==="sell"));
});
test("detect destructive and delegated execution patterns",()=>{
  const r=analyzeSources({"T.sol":"contract T{function destroy() public { selfdestruct(payable(msg.sender)); } function f(address target) public { target.delegatecall(abi.encode(1)); }}"});
  assert.ok(r.findings.some(x=>x.rule==="selfdestruct"));
  assert.ok(r.findings.some(x=>x.rule==="delegatecall"));
});
test("no data has unknown score rather than safe score",()=>assert.equal(riskSummary([],"none",{isProxy:false}).score,null));
test("ABI-only matches are labelled ABI, not source evidence",()=>{
  const r=analyzeSources({},[{type:"function",name:"setTax",inputs:[{type:"uint256"}]}]);
  assert.equal(r.coverage,"abi-only");assert.equal(r.findings[0].basis,"abi");
});
test("normalize Sourcify sources and proxy metadata",()=>{
  const d=normalizeSourcify({abi:[],sources:{"T.sol":{content:"contract T{}"}},compilation:{name:"T"},proxyResolution:{isProxy:true,implementations:[{address:A}]}});
  assert.equal(d.name,"T");assert.equal(d.sourceFiles["T.sol"],"contract T{}");assert.equal(d.proxy.implementations[0],A);
});
test("normalize Blockscout primary and additional source files",()=>{
  const d=normalizeBlockscout({name:"T",source_code:"contract T{}",additional_sources:[{file_path:"Other.sol",source_code:"library O{}"}]});
  assert.equal(Object.keys(d.sourceFiles).length,2);assert.ok(d.verified);
});
