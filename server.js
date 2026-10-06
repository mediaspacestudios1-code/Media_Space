import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat, mkdir, appendFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
try { const env = await readFile(join(root, '.env'), 'utf8'); for (const line of env.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); } } catch {}
const port = Number(process.env.PORT || 3000);
const services = ['Car Decors','Catering','Dress Shop','Holidays','Personal Booking','Saloon'];
const events = ['Wedding','Birthday','Puberty','Baby Shower','Ear Piercing','Other'];
const prices = { 'Wedding Package 1':'₹45,999','Wedding Package 2':'₹69,999','Wedding Package 3':'₹99,999','Event Package 1':'₹14,999','Event Package 2':'₹34,999','Basic':'₹19,999','Standard':'₹39,999','Premium':'₹59,999' };
const packageIncludes = {
  'Wedding Package 1':['Traditional photo','Traditional video','12×36 album · 30 sheets','2 calendars'],
  'Wedding Package 2':['Traditional photo','Traditional video','Candid photo','Candid video','12×36 album · 35 sheets','2 calendars'],
  'Wedding Package 3':['Traditional photo','Traditional video','Candid photo','Candid video','Drone shot · engagement or marriage','12×36 premium album','2 calendars','2 frames'],
  'Event Package 1':['Traditional photo','12×36 album · 20 sheets'],
  'Event Package 2':['Traditional photo','Candid video','12×36 album · 20 sheets'],
  'Basic':['10 feed posts/month','Content caption writing','5 feed posters','Post scheduling','Hashtag research','Instagram handling'],
  'Standard':['20 feed posts/month','10 feed posters','Caption copywriting','Post scheduling and publishing','Comment and message replies'],
  'Premium':['30 feed posts/month','Meta ads','Pro caption copywriting','Content calendar planning','Competitor analysis','Monthly analytics report']
};
const windows = new Map();
const types = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime','.aac':'audio/aac','.svg':'image/svg+xml' };
function clean(v, max=500) { return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/<[^>]*>/g,'').trim().slice(0,max); }
function sendJson(res,status,payload) { if(res.headersSent){res.destroy();return;}res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(payload)); }
function discordWebhook() {
  const raw=process.env.DISCORD_WEBHOOK_URL;
  if(!raw)return null;
  try { const url=new URL(raw); if(url.protocol!=='https:'||!['discord.com','discordapp.com'].includes(url.hostname)||!/^\/api\/webhooks\/\d+\/[^/]+\/?$/.test(url.pathname))return null; url.searchParams.set('wait','true'); return url; }
  catch { return null; }
}
async function deliverToDiscord(payload,label) {
  const hook=discordWebhook();
  if(!hook)return {ok:false,configured:Boolean(process.env.DISCORD_WEBHOOK_URL),status:0};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(hook,{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify(payload)});
    if(!response.ok)console.error(`${label} delivery failed: Discord HTTP`,response.status);
    return {ok:response.ok,configured:true,status:response.status};
  } catch(error) {
    console.error(`${label} delivery failed:`,error.name==='AbortError'?'timeout':'network error');
    return {ok:false,configured:true,status:0};
  } finally { clearTimeout(timer); }
}
function allowOrigin(req,res) { const origin=req.headers.origin;if(!origin)return true;let allowed=false;try{allowed=process.env.ALLOWED_ORIGIN?new URL(origin).origin===new URL(process.env.ALLOWED_ORIGIN).origin:new URL(origin).host===req.headers.host;}catch{}if(allowed){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');}return allowed; }
function validate(d) {
  const keys = ['name','phone','email','event','date','place'];
  for (const k of keys) if (!clean(d[k], k==='place'?160:120)) return `${k} is required.`;
  if (!events.includes(d.event) || (d.service && !services.includes(d.service))) return 'Choose a valid event.';
  if (!/^\+?[0-9() .-]{7,20}$/.test(d.phone)) return 'Enter a valid phone number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || d.email.length>254) return 'Enter a valid email address.';
  const date = new Date(`${d.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==d.date) return 'Enter a valid event date.';
  const validPackages = d.event==='Wedding' ? ['Wedding Package 1','Wedding Package 2','Wedding Package 3'] : ['Birthday','Puberty','Baby Shower','Ear Piercing'].includes(d.event) ? ['Event Package 1','Event Package 2'] : d.event==='Other' ? ['Basic','Standard','Premium'] : [];
  if (validPackages.length && !validPackages.includes(d.package)) return 'Choose a package for this event.';
  if (!validPackages.length && d.package) return 'Package selection does not match this event.';
  return null;
}
function embed(d,id,now) { const val=x=>clean(x,1000)||'—', requirements=clean(d.message,600)||'None provided', selectedPackage=clean(d.package,100), includes=packageIncludes[selectedPackage]; return { title:'New Customer Booking Enquiry', color:0xd6b778, fields:[
  {name:'Customer Details',value:`**Name:** ${val(d.name)}\n**Phone:** ${val(d.phone)}\n**Email:** ${val(d.email)}`},
  {name:'Event Details',value:`**Function:** ${val(d.event)}${d.service?`\n**Service:** ${val(d.service)}`:''}\n**Date:** ${val(d.date)}\n**Place:** ${val(d.place)}`},
  {name:'Selected Package',value:`**Package:** ${selectedPackage||'No package selected'}\n**Price:** ${prices[selectedPackage]||'—'}${includes?`\n**Includes:** ${includes.join(' · ')}`:''}`},
  {name:'Additional requirements',value:requirements},
  {name:'Submission Details',value:`**Enquiry ID:** ${id}\n**Submitted:** ${now.toISOString()}`}
 ], timestamp:now.toISOString() }; }
async function booking(req,res) {
  const ip=(req.headers['x-forwarded-for']||'local').split(',')[0].trim(), now=Date.now(), prev=windows.get(ip)||[];
  const recent=prev.filter(t=>now-t<60000); if(recent.length>=5){res.writeHead(429,{'content-type':'application/json'});return res.end(JSON.stringify({error:'Please wait a minute before sending another enquiry.'}));} windows.set(ip,[...recent,now]);
  let raw=''; for await (const chunk of req) {raw+=chunk; if(raw.length>20000)return sendJson(res,413,{error:'Request is too large.'});}
  let d; try{d=JSON.parse(raw)}catch{res.writeHead(400,{'content-type':'application/json'});return res.end(JSON.stringify({error:'Invalid request.'}));}
  const error=validate(d); if(error){res.writeHead(400,{'content-type':'application/json'});return res.end(JSON.stringify({error}));}
  if(!discordWebhook())return sendJson(res,503,{ok:false,success:false,error:'Discord delivery is not configured. Set DISCORD_WEBHOOK_URL on the Node server.'});
  const id=randomUUID(),time=new Date(),delivery=await deliverToDiscord({embeds:[embed(d,id,time)],allowed_mentions:{parse:[]}},'Booking');
  if(!delivery.ok)return sendJson(res,502,{ok:false,success:false,error:delivery.configured?'Discord could not confirm delivery. Check the webhook and target channel.':'Discord delivery is not configured.'});
  try{await mkdir(join(root,'data'),{recursive:true});await appendFile(join(root,'data','enquiries.jsonl'),JSON.stringify({id,createdAt:time.toISOString()})+'\n');}catch{}
  return sendJson(res,200,{ok:true,success:true,message:'Enquiry delivered to Discord.',id});
}
async function contact(req,res) {
  const ip=(req.headers['x-forwarded-for']||'local').split(',')[0].trim(), now=Date.now(), prev=windows.get(`contact:${ip}`)||[];
  const recent=prev.filter(t=>now-t<60000); if(recent.length>=5){res.writeHead(429,{'content-type':'application/json'});return res.end(JSON.stringify({success:false,message:'Please wait a minute before sending another message.'}));} windows.set(`contact:${ip}`,[...recent,now]);
  let raw=''; for await (const chunk of req) {raw+=chunk; if(raw.length>12000){res.writeHead(413,{'content-type':'application/json'});return res.end(JSON.stringify({success:false,message:'Your message is too large. Please shorten it and try again.'}));}}
  let d; try{d=JSON.parse(raw)}catch{return sendJson(res,400,{success:false,message:'Please check your details and try again.'});}
  if(!d||typeof d!=='object'||Array.isArray(d))return sendJson(res,400,{success:false,message:'Please check your details and try again.'});
  if(String(d.name??'').length>120||String(d.email??'').length>254||String(d.phone??'').length>30||String(d.subject??'').length>160||String(d.message??'').length>3000)return sendJson(res,400,{success:false,message:'Please shorten your message and try again.'});
  const name=clean(d.name,120), email=clean(d.email,254), phone=clean(d.phone,30), subject=clean(d.subject,160), message=clean(d.message,3000);
  if(clean(d.website,200)){res.writeHead(400,{'content-type':'application/json'});return res.end(JSON.stringify({success:false,message:'Unable to send your message right now.'}));}
  if(!name||!message||!email)return sendJson(res,400,{success:false,message:'Please fill in all required fields.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n]/.test(email))return sendJson(res,400,{success:false,message:'Please enter a valid email address.'});
  if(phone&&!/^\+?[0-9() .-]{7,30}$/.test(phone))return sendJson(res,400,{success:false,message:'Please enter a valid phone number.'});
  if(/https?:\/\/|discord\.gg|@everyone|@here/i.test(`${name} ${subject} ${message}`)){res.writeHead(400,{'content-type':'application/json'});return res.end(JSON.stringify({success:false,message:'Unable to send your message right now.'}));}
  if(!discordWebhook())return sendJson(res,503,{success:false,message:'Discord delivery is not configured. Set DISCORD_WEBHOOK_URL on the Node server.'});
  const cut=s=>s.slice(0,1024), time=new Date();
  const customer=[`**Name:** ${cut(name)}`,`**Email:** ${cut(email)}`];if(phone)customer.push(`**Phone:** ${cut(phone)}`);
  const fields=[{name:'Customer information',value:customer.join('\n')}];if(subject)fields.push({name:'Subject',value:cut(subject)});fields.push({name:'Message',value:cut(message)},{name:'Source',value:'Website Contact Form'});
  const delivery=await deliverToDiscord({embeds:[{title:'📩 New Website Enquiry',color:0xd6b778,fields,timestamp:time.toISOString()}],allowed_mentions:{parse:[]}},'Contact');
  if(!delivery.ok)return sendJson(res,502,{success:false,message:delivery.configured?'Discord could not confirm delivery. Check the webhook and target channel.':'Discord delivery is not configured.'});
  return sendJson(res,200,{success:true,message:'Message delivered to Discord.'});
}
http.createServer(async(req,res)=>{
  const requestUrl=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`), pathname=requestUrl.pathname;
  try {
    if(pathname.startsWith('/api/')) {
      if(!allowOrigin(req,res))return sendJson(res,403,{success:false,message:'Unable to send your message right now.'});
      if(req.method==='OPTIONS') {res.setHeader('access-control-allow-methods','POST, OPTIONS');res.setHeader('access-control-allow-headers','Content-Type');return sendJson(res,200,{success:true});}
      if(pathname==='/api/photoshoots'&&req.method==='GET') {
        const files=await readdir(join(root,'PhotoShoots'),{withFileTypes:true});
        const images=files.filter(file=>file.isFile()&&/\.(?:jpe?g|png|webp|gif)$/i.test(file.name)).map(file=>file.name).sort((a,b)=>{
          const parse=name=>{const stem=name.replace(/\.[^.]+$/,'');const match=stem.match(/^(.*?)(?:\s+\((\d+)\))?$/);return [match[1].toLocaleLowerCase(),Number(match[2]||0)];};
          const [aStem,aCopy]=parse(a),[bStem,bCopy]=parse(b);return aStem.localeCompare(bStem)||aCopy-bCopy||a.localeCompare(b);
        }).map(name=>({name,url:`/PhotoShoots/${encodeURIComponent(name)}`}));
        return sendJson(res,200,{images});
      }
      if(pathname==='/api/health'&&req.method==='GET'){const valid=Boolean(discordWebhook());return sendJson(res,200,{ok:true,discordConfigured:valid,message:valid?'Discord webhook is configured.':'Discord webhook is missing or invalid.'});}
      if(pathname==='/api/booking'&&req.method==='POST') return await booking(req,res);
      if(pathname==='/api/contact'&&req.method==='POST') return await contact(req,res);
      if(pathname==='/api/booking'||pathname==='/api/contact') return sendJson(res,405,{success:false,message:'Method not allowed.'});
      return sendJson(res,404,{success:false,message:'API route not found.'});
    }
    let path;try{path=decodeURIComponent(pathname)}catch{return sendJson(res,400,{success:false,message:'Invalid request path.'})}if(path==='/')path='/index.html';const full=normalize(join(root,path)),relativePath=relative(root,full);if(relativePath==='..'||relativePath.startsWith(`..${process.platform==='win32'?'\\':'/'}`)||isAbsolute(relativePath)){res.writeHead(403,{'content-type':'text/plain; charset=utf-8'});return res.end('Forbidden')}
    const info=await stat(full),type=types[extname(full).toLowerCase()]||'application/octet-stream',cache=extname(full).match(/\.(mov|mp4|png|jpg)$/i)?'public,max-age=86400':'no-cache',range=req.headers.range;
    if(range&&type.startsWith('video/')){const match=range.match(/^bytes=(\d*)-(\d*)$/);if(!match){res.writeHead(416,{'content-range':`bytes */${info.size}`});return res.end()}let start=match[1]?Number(match[1]):0,end=match[2]?Number(match[2]):info.size-1;if(!match[1]&&match[2]){const suffix=Number(match[2]);start=Math.max(0,info.size-suffix);end=info.size-1}if(start>=info.size||end<start){res.writeHead(416,{'content-range':`bytes */${info.size}`});return res.end()}end=Math.min(end,info.size-1);res.writeHead(206,{'content-type':type,'accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${info.size}`,'content-length':end-start+1,'cache-control':cache});return createReadStream(full,{start,end}).pipe(res)}
    if(type.startsWith('video/')){res.writeHead(200,{'content-type':type,'accept-ranges':'bytes','content-length':info.size,'cache-control':cache});return createReadStream(full).pipe(res)}const body=await readFile(full);res.writeHead(200,{'content-type':type,'content-length':body.length,'cache-control':cache});res.end(body);
  } catch(error) {
    if(pathname.startsWith('/api/')){console.error('API request failed:',error.name==='AbortError'?'timeout':'internal error');return sendJson(res,500,{success:false,message:'Something went wrong. Please try again.'})}
    if(!res.headersSent){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found')}
  }
}).listen(port,()=>console.log(`Media Space running at http://localhost:${port}`));

