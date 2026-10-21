import {test} from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const d=JSON.parse(readFileSync(new URL("../public/blacklist/data.json",import.meta.url),"utf8"));
test("metadata and source license declarations",()=>{
 assert.equal(d.metadata.sources.length,2);
 assert.ok(d.metadata.sources.every(s=>s.license==="MIT"&&s.url.startsWith("https://github.com/")));
 assert.equal(d.metadata.counts.addresses,d.addresses.length);
 assert.equal(d.metadata.counts.domains,d.domains.length);
});
test("normalized address data is valid unique and case insensitive",()=>{
 const values=d.addresses.map(x=>x.value);
 assert.equal(new Set(values).size,values.length);
 assert.ok(values.every(x=>/^0x[a-f0-9]{40}$/.test(x)));
 assert.ok(d.addresses.every(x=>x.sources.length>=1&&x.reports.length>=1));
});
test("domain data contains hostnames only, not scam hyperlinks",()=>{
 const values=d.domains.map(x=>x.value);
 assert.equal(new Set(values).size,values.length);
 assert.ok(values.every(x=>!/[\/\s]/.test(x)&&x.includes(".")));
});
test("cross-source matches are represented without treating absence as safe",()=>{
 const overlap=d.addresses.filter(x=>x.sources.includes("mew")&&x.sources.includes("etherscamdb")).length;
 assert.equal(overlap,d.metadata.counts.overlapAddresses);
 assert.ok(overlap>0);
});
