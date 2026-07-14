import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = path.join(root, "content", "blog");
const port = Number(process.env.BLOG_CMS_PORT || 4310);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function posts() {
  const files = (await fs.readdir(contentDir)).filter((file) => file.endsWith(".json"));
  const values = await Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(contentDir, file), "utf8"))));
  return values.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function valid(post) {
  return post &&
    post.schemaVersion === 1 &&
    slugPattern.test(post.slug) &&
    ["draft", "published"].includes(post.status) &&
    ["date", "dateLabel", "title", "subtitle", "excerpt", "readTime"].every((key) => typeof post[key] === "string") &&
    Array.isArray(post.tags) &&
    Array.isArray(post.blocks) &&
    Array.isArray(post.sources);
}

function reply(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readBody(request) {
  let data = "";
  for await (const chunk of request) {
    data += chunk;
    if (data.length > 2_000_000) throw new Error("The document is too large.");
  }
  return JSON.parse(data);
}

const page = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Arash Blog CMS</title>
  <style>
    :root{font-family:Arial,sans-serif;color:#171717;background:#f5f5f2}*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit}button{cursor:pointer}.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d4d4d4;padding:18px 28px;background:#fff}.top p{margin:0 0 4px;color:#991b1b;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.top h1{font-size:24px;margin:0}.top div:last-child{display:flex;gap:18px;align-items:center;color:#737373;font-size:12px}.top a{color:#991b1b;font-weight:700}.layout{display:grid;grid-template-columns:260px minmax(0,1fr);gap:28px;padding:28px}.sidebar{display:flex;flex-direction:column;gap:6px}.sidebar button{display:grid;gap:4px;text-align:left;padding:12px;border:0;border-left:2px solid transparent;background:transparent}.sidebar button:hover,.sidebar button.active{border-color:#991b1b;background:#fff}.sidebar strong{font-size:13px}.sidebar small{color:#737373;font-size:10px}.sidebar .new{display:block;border:1px solid #ccc;text-align:center;margin-bottom:8px;font-weight:700}.editor{background:#fff;border:1px solid #ddd;padding:42px}.editor-head{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #ddd;padding-bottom:22px;margin-bottom:26px}.editor-head h2{font-size:28px;margin:0}.save{background:#171717;color:#fff;border:0;border-radius:4px;padding:10px 16px;font-size:12px;font-weight:700}.fields{display:grid;grid-template-columns:1fr 1fr;gap:19px}.fields label{display:grid;gap:7px;color:#525252;font-size:11px;font-weight:700}.fields input,.fields textarea,.fields select{border:1px solid #ccc;border-radius:3px;padding:10px;color:#171717;font-weight:400}.wide{grid-column:1/-1}.code{font-family:Consolas,monospace;font-size:12px;line-height:1.55}.empty{color:#737373}.status.bad{color:#991b1b}@media(max-width:760px){.top{align-items:flex-start;gap:15px}.layout{grid-template-columns:1fr;padding:14px}.sidebar{max-height:200px;overflow:auto}.editor{padding:22px}.fields{grid-template-columns:1fr}.wide{grid-column:1}.editor-head,.top{flex-direction:column}}
  </style>
</head>
<body>
  <header class="top"><div><p>Local development only</p><h1>Blog CMS</h1></div><div><span id="status">Loading content...</span><a href="http://127.0.0.1:3001/blog" target="_blank">Preview blog ↗</a></div></header>
  <main class="layout"><aside class="sidebar" id="sidebar"><button class="new" id="new">+ New post</button></aside><form class="editor" id="editor"><div class="editor-head"><h2 id="editorTitle">Post document</h2><button class="save" type="submit">Save locally</button></div><div class="fields">
    <label>Title<input id="title" required></label><label>Slug<input id="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required></label>
    <label class="wide">Subtitle<textarea id="subtitle" rows="2" required></textarea></label><label class="wide">Excerpt<textarea id="excerpt" rows="3" required></textarea></label>
    <label>Date<input id="date" type="date" required></label><label>Date label<input id="dateLabel" required></label>
    <label>Read time<input id="readTime" required></label><label>Status<select id="postStatus"><option value="draft">Draft</option><option value="published">Published</option></select></label>
    <label class="wide">Tags<input id="tags"></label><label class="wide">Content blocks<textarea class="code" id="blocks" rows="24" spellcheck="false"></textarea></label>
    <label class="wide">Sources<textarea class="code" id="sources" rows="10" spellcheck="false"></textarea></label>
  </div></form></main>
  <script>
    let allPosts=[];let current=null;
    const byId=id=>document.getElementById(id);const fields=["title","slug","subtitle","excerpt","date","dateLabel","readTime"];
    function blank(){const date=new Date().toISOString().slice(0,10);return{schemaVersion:1,slug:"new-post-"+date,status:"draft",date,dateLabel:new Intl.DateTimeFormat("en-US",{dateStyle:"long"}).format(new Date()),title:"A new technical note",subtitle:"Write one clear sentence about the question.",excerpt:"This short summary appears on the homepage and blog index.",readTime:"5 min read",tags:["Research note"],featured:false,blocks:[{type:"paragraph",text:"Start the note here."},{type:"heading",id:"first-question",text:"The first question"},{type:"paragraph",text:"Continue the explanation here."}],sources:[]}}
    function draw(){const side=byId("sidebar");side.querySelectorAll("button:not(.new)").forEach(node=>node.remove());allPosts.forEach(post=>{const button=document.createElement("button");button.type="button";button.className=current&&current.slug===post.slug?"active":"";button.innerHTML="<strong></strong><small></small>";button.querySelector("strong").textContent=post.title;button.querySelector("small").textContent=post.status+" · "+post.date;button.onclick=()=>select(post);side.append(button)})}
    function select(post){current=structuredClone(post);fields.forEach(key=>byId(key).value=current[key]);byId("postStatus").value=current.status;byId("tags").value=current.tags.join(", ");byId("blocks").value=JSON.stringify(current.blocks,null,2);byId("sources").value=JSON.stringify(current.sources,null,2);byId("editorTitle").textContent=current.title;byId("status").textContent="Editing local content";byId("status").className="status";draw()}
    async function load(){const result=await fetch("/api/posts");allPosts=await result.json();select(allPosts[0]||blank())}
    byId("new").onclick=()=>select(blank());
    byId("editor").onsubmit=async event=>{event.preventDefault();try{fields.forEach(key=>current[key]=byId(key).value);current.status=byId("postStatus").value;current.tags=byId("tags").value.split(",").map(x=>x.trim()).filter(Boolean);current.blocks=JSON.parse(byId("blocks").value);current.sources=JSON.parse(byId("sources").value);byId("status").textContent="Saving...";const response=await fetch("/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({post:current})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Save failed.");allPosts=[current,...allPosts.filter(post=>post.slug!==current.slug)].sort((a,b)=>b.date.localeCompare(a.date));draw();byId("editorTitle").textContent=current.title;byId("status").textContent="Saved at "+new Date().toLocaleTimeString();byId("status").className="status"}catch(error){byId("status").textContent=error.message;byId("status").className="status bad"}};
    load().catch(()=>{byId("status").textContent="Could not load content.";byId("status").className="status bad"});
  </script>
</body>
</html>`;

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") return reply(response, 200, page, "text/html; charset=utf-8");
    if (request.method === "GET" && request.url === "/api/posts") return reply(response, 200, await posts());
    if (request.method === "POST" && request.url === "/api/posts") {
      const { post } = await readBody(request);
      if (!valid(post)) return reply(response, 400, { error: "The post document is not valid." });
      await fs.writeFile(path.join(contentDir, `${post.slug}.json`), `${JSON.stringify(post, null, 2)}\n`, "utf8");
      return reply(response, 200, { ok: true });
    }
    return reply(response, 404, { error: "Not found" });
  } catch (error) {
    return reply(response, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local blog CMS: http://127.0.0.1:${port}`);
});
