'use strict';
const $ = id => document.getElementById(id);
const paths = {
  plus:'M12 5v14M5 12h14', search:'m21 21-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', bookmark:'M6 3h12v18l-6-4-6 4V3Z',
  shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4ZM9 12l2 2 4-4',
  settings:'m9 3-.6 2.5-2.2 1.3L3.8 6 1.9 9.3l1.8 1.7v2l-1.8 1.7L3.8 18l2.4-.8 2.2 1.3L9 21h4l.6-2.5 2.2-1.3 2.4.8 1.9-3.3-1.8-1.7v-2l1.8-1.7L18.2 6l-2.4.8-2.2-1.3L13 3H9ZM14 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  chevron:'m6 9 6 6 6-6', moon:'M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z', sun:'M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  sparkles:'m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4',
  paperclip:'m21 11-8 8a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8-8',
  'arrow-up':'M12 19V5m-6 6 6-6 6 6', shuffle:'m18 3 3 3-3 3M3 6h3c6 0 6 12 12 12h3m-3-3 3 3-3 3M3 18h3c2 0 3-1 4-3m4-6c1-2 2-3 4-3h3',
  pen:'m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5', code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
  book:'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3V4Zm9 2v15', bulb:'M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2',
  x:'m6 6 12 12M6 18 18 6', menu:'M4 6h16M4 12h16M4 18h16', copy:'M9 9h12v12H9V9ZM5 15H3V3h12v2',
  retry:'M3 11a9 9 0 1 1 3 7M3 4v7h7', download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', stop:'M6 6h12v12H6z', check:'m5 12 4 4L19 6'
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.chat}"/></svg>`; }
function icons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readStore(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Browser storage is full or unavailable. Export your chat to keep it.'); } }
let chats = readStore('rai.chats.v2', []);
if (!Array.isArray(chats)) chats = [];
chats = chats.filter(c => c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages));
let settings = readStore('rai.settings.v2', {model:'', temperature:0.7, dark:false});
if (!settings || typeof settings !== 'object') settings = {model:'', temperature:0.7, dark:false};
let activeId = null, savedOnly = false, controller = null, attachment = null, status = {connected:false, models:[], default_model:'', provider:'AI'}, promptSet = 0;
const prompts = [
  {title:'Write something', subtitle:'Find the right words, faster.', icon:'pen', color:'peach', category:'Write', text:'Help me write a clear, friendly email. Ask me who it is for and what I want to say.'},
  {title:'Crack the code', subtitle:'A fresh pair of eyes for your code.', icon:'code', color:'violet', category:'Code', text:'Help me debug my code. Ask me to share the code, the expected behavior, and any error messages.'},
  {title:'Learn something', subtitle:'Make the complicated click.', icon:'book', color:'green', category:'Learn', text:'Teach me a new concept with a simple explanation, an example, and a quick question to test my understanding. Ask me which topic I want to explore.'},
  {title:'Think bigger', subtitle:'Turn a little spark into an idea.', icon:'bulb', color:'blue', category:'Create', text:'Be my brainstorming partner. Ask me about an idea or problem, then help me explore five creative possibilities.'},
  {title:'Polish my writing', subtitle:'A little clearer. A little more you.', icon:'pen', color:'peach', category:'Write', text:'Help me improve a piece of writing while keeping my voice. Ask me to paste the text and tell you who will read it.'},
  {title:'Plan my day', subtitle:'Make room for what matters.', icon:'bulb', color:'blue', category:'Create', text:'Help me make a realistic plan for today. Ask me for my tasks, available time, and highest priority.'},
  {title:'Explain this code', subtitle:'Understand the how and why.', icon:'code', color:'violet', category:'Code', text:'Explain code to me step by step, including what it does and why. Ask me to paste the code and tell you my experience level.'},
  {title:'Study smarter', subtitle:'A study plan that fits your life.', icon:'book', color:'green', category:'Learn', text:'Help me build a practical study plan. Ask me what I am learning, my deadline, and how much time I have each day.'},
  {title:'A story starts here', subtitle:'Let your imagination wander.', icon:'pen', color:'peach', category:'Write', text:'Help me create a short story. Ask me for a genre, a character, and a setting, then suggest three possible openings.'},
  {title:'Build an idea', subtitle:'From what if to what’s next.', icon:'bulb', color:'blue', category:'Create', text:'Help me turn an idea into a practical project. Ask me about the idea, who it helps, and what resources I have.'},
  {title:'Interview practice', subtitle:'A little practice. More confidence.', icon:'code', color:'violet', category:'Code', text:'Run a mock technical interview with me. Ask about the role and my experience, then ask one question at a time and give constructive feedback.'},
  {title:'Summarize a text', subtitle:'The big picture, in fewer words.', icon:'book', color:'green', category:'Learn', text:'Summarize a text into key takeaways and action items. Ask me to paste the text or attach a text file.'}
];
let toastTimer;
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
const currentChat = () => chats.find(c => c.id === activeId);
function persist() { writeStore('rai.chats.v2', chats); }
function saveSettings() { writeStore('rai.settings.v2', settings); }
function applyTheme() { document.body.classList.toggle('dark', !!settings.dark); $('theme-button').innerHTML = icon(settings.dark ? 'sun' : 'moon'); $('theme-button').setAttribute('aria-label', settings.dark ? 'Switch to light theme' : 'Switch to dark theme'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebar-scrim').classList.remove('open'); }
function setNavigation() { $('nav-chats').classList.toggle('active', !savedOnly); $('nav-saved').classList.toggle('active', savedOnly); $('history-label').textContent = savedOnly ? 'SAVED CONVERSATIONS' : 'RECENT CONVERSATIONS'; }
function renderHistory() {
  $('chat-count').textContent = chats.length;
  setNavigation();
  const list = chats.filter(c => !savedOnly || c.saved).sort((a,b) => b.updated - a.updated);
  $('history').replaceChildren();
  if (!list.length) { $('history').innerHTML = `<div class="history-empty"><strong>${savedOnly ? 'Keep your good ideas close.' : 'A clean slate. A curious mind.'}</strong>${savedOnly ? 'Save a conversation using its bookmark.' : 'Your conversations will appear here.<br>Start with a little “what if?”'}</div>`; return; }
  list.forEach(chat => {
    const row = document.createElement('div'); row.className = 'history-item' + (chat.id === activeId ? ' current' : '');
    const open = document.createElement('button'); open.className = 'history-open'; open.title = chat.title;
    open.innerHTML = icon(chat.saved ? 'bookmark' : 'chat') + `<span>${escapeHTML(chat.title)}</span>`;
    open.onclick = () => openChat(chat.id);
    const more = document.createElement('button'); more.className = 'history-more'; more.textContent = '···'; more.setAttribute('aria-label', `Manage ${chat.title}`); more.onclick = () => manageChat(chat);
    row.append(open,more); $('history').append(row);
  });
}
function newChat() {
  if (controller) { toast('Stop the current reply before starting another chat.'); return; }
  activeId = null; attachment = null; $('prompt').value = ''; renderAttachment(); closeSidebar(); renderView(); $('prompt').focus();
}
function openChat(id) {
  if (controller) { toast('Stop the current reply before switching chats.'); return; }
  activeId = id; attachment = null; $('prompt').value = ''; renderAttachment(); closeSidebar(); $('modal').close(); renderView(); window.scrollTo(0,0);
}
function renderView() {
  const chat = currentChat(); const hasMessages = !!chat?.messages.length;
  $('welcome').hidden = hasMessages; $('suggestions').hidden = hasMessages; $('conversation').hidden = !hasMessages;
  $('workspace').classList.toggle('chat-mode', hasMessages); $('page-title').textContent = chat?.title || 'New conversation';
  renderHistory(); renderMessages();
}
// Render only escaped text and a small Markdown subset: model output can never inject HTML.
function inlineMD(text) { return escapeHTML(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>'); }
function markdown(text) {
  let html = '', inCode = false, code = [], list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) { closeList(); if (inCode) { html += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`; code = []; } inCode = !inCode; continue; }
    if (inCode) { code.push(line); continue; }
    const bullet = line.match(/^\s*(?:[-*]|(\d+)\.)\s+(.+)/);
    if (bullet) { const type = bullet[1] ? 'ol' : 'ul'; if (list !== type) { closeList(); html += `<${type}>`; list = type; } html += `<li>${inlineMD(bullet[2])}</li>`; continue; }
    closeList();
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) html += `<${heading[1].length <= 2 ? 'h2' : 'h3'}>${inlineMD(heading[2])}</${heading[1].length <= 2 ? 'h2' : 'h3'}>`;
    else if (line.startsWith('> ')) html += `<blockquote>${inlineMD(line.slice(2))}</blockquote>`;
    else if (line.trim()) html += `<p>${inlineMD(line)}</p>`;
  }
  closeList(); if (code.length) html += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`;
  return html;
}
function renderMessages() {
  const chat = currentChat(); $('conversation').replaceChildren(); if (!chat) return;
  const toolbar = document.createElement('div'); toolbar.className = 'chat-toolbar';
  const bookmark = document.createElement('button'); bookmark.innerHTML = icon('bookmark') + (chat.saved ? 'Saved' : 'Save chat'); bookmark.onclick = () => { chat.saved = !chat.saved; persist(); renderHistory(); renderMessages(); };
  const exportButton = document.createElement('button'); exportButton.innerHTML = icon('download') + 'Export'; exportButton.onclick = () => exportChat(chat);
  toolbar.append(bookmark, exportButton); $('conversation').append(toolbar);
  chat.messages.forEach((message, index) => {
    const row = document.createElement('article'); row.className = 'message';
    const avatar = document.createElement('div'); avatar.className = 'avatar' + (message.role === 'user' ? ' user' : '');
    if (message.role === 'user') avatar.textContent = 'Y';
    else avatar.innerHTML = '<span class="avatar-logo logo-crop"><img src="/assets/kmitl-logo.png" alt=""></span>';
    const main = document.createElement('div'); main.className = 'message-main';
    const heading = document.createElement('div'); heading.className = 'message-heading'; heading.textContent = message.role === 'user' ? 'You' : 'Rai Buddy';
    const time = document.createElement('span'); time.className = 'message-time'; time.textContent = new Date(message.time || chat.updated).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); heading.append(time);
    const body = document.createElement('div'); body.className = 'message-body';
    if (message.role === 'user') { const p = document.createElement('p'); p.textContent = message.display || message.content; body.append(p); }
    else if (message.content) body.innerHTML = markdown(message.content);
    else if (controller && index === chat.messages.length - 1) body.innerHTML = '<p class="thinking">A little thinking…</p>';
    if (message.error) { const error = document.createElement('div'); error.className = 'message-error'; error.textContent = message.error; body.append(error); }
    if (message.stopped) { const note = document.createElement('div'); note.className = 'stopped-note'; note.textContent = 'Response stopped'; body.append(note); }
    main.append(heading,body);
    if (message.role === 'assistant' && !controller) {
      const actions = document.createElement('div'); actions.className = 'message-actions';
      if (message.content) { const copy = document.createElement('button'); copy.innerHTML = icon('copy') + 'Copy'; copy.onclick = async () => { try { await navigator.clipboard.writeText(message.content); toast('Copied to clipboard.'); } catch { toast('Clipboard unavailable. Use Export to keep this reply.'); } }; actions.append(copy); }
      if (index === chat.messages.length-1) { const retry = document.createElement('button'); retry.innerHTML = icon('retry') + 'Try again'; retry.onclick = () => { chat.messages.pop(); generate(chat); }; actions.append(retry); }
      main.append(actions);
    }
    row.append(avatar,main); $('conversation').append(row);
  });
}
function promptCard(item, container) {
  const card = document.createElement('button'); card.className = 'prompt-card';
  card.innerHTML = `<span class="prompt-icon ${item.color}">${icon(item.icon)}</span><span class="prompt-arrow">↗</span><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.subtitle)}</p>`;
  card.onclick = () => { $('prompt').value = item.text; $('modal').close(); closeSidebar(); $('prompt').focus(); $('compose-area').scrollIntoView({behavior:'smooth',block:'center'}); };
  container.append(card);
}
function renderPrompts() { $('prompt-grid').replaceChildren(); prompts.slice(promptSet*4,promptSet*4+4).forEach(p => promptCard(p,$('prompt-grid'))); }
function showModal(title, eyebrow = 'YOUR WORKSPACE') { $('modal-title').textContent = title; $('modal-eyebrow').textContent = eyebrow; $('modal-content').replaceChildren(); if (!$('modal').open) $('modal').showModal(); return $('modal-content'); }
function openLibrary() {
  const content = showModal('A spark for every kind of day.', 'THE PROMPT LIBRARY');
  const tabs = document.createElement('div'); tabs.className = 'library-tabs';
  const grid = document.createElement('div'); grid.className = 'library-grid';
  const filter = category => { grid.replaceChildren(); prompts.filter(p => category === 'All' || p.category === category).forEach(p => promptCard(p,grid)); tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.textContent === category)); };
  ['All','Write','Code','Learn','Create'].forEach(category => { const b = document.createElement('button'); b.textContent = category; b.onclick = () => filter(category); tabs.append(b); });
  content.append(tabs,grid); filter('All');
}
function openSearch() {
  const content = showModal('Find a conversation.', 'YOUR IDEAS, REVISITED');
  const input = document.createElement('input'); input.className = 'modal-input'; input.type = 'search'; input.placeholder = 'Search titles and messages…'; input.setAttribute('aria-label','Search conversations');
  const results = document.createElement('div'); results.className = 'search-results';
  const search = () => {
    results.replaceChildren(); const query = input.value.toLowerCase();
    const found = chats.filter(c => c.title.toLowerCase().includes(query) || c.messages.some(m => m.content.toLowerCase().includes(query))).sort((a,b)=>b.updated-a.updated);
    if (!found.length) { results.innerHTML = '<p class="modal-intro">No conversations found. Your next idea is a new chat away.</p>'; }
    found.forEach(chat => { const b = document.createElement('button'); b.className = 'search-result'; b.innerHTML = `${escapeHTML(chat.title)}<small>${chat.messages.filter(m=>m.role==='user').length} messages · ${new Date(chat.updated).toLocaleDateString()}</small>`; b.onclick = () => openChat(chat.id); results.append(b); });
  };
  input.oninput = search; content.append(input,results); search(); input.focus();
}
function exportChat(chat) {
  const text = `# ${chat.title}\n\nExported from Rai Buddy\n\n` + chat.messages.map(m => `## ${m.role === 'user' ? 'You' : 'Rai Buddy'}\n\n${m.content}${m.error ? '\n\nError: '+m.error : ''}`).join('\n\n---\n\n');
  const url = URL.createObjectURL(new Blob([text], {type:'text/markdown;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = chat.title.replace(/[^\p{L}\p{N}\s-]/gu,'').slice(0,60) + '.md'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('Conversation exported.');
}
function manageChat(chat) {
  if (controller) { toast('Stop the current reply before managing chats.'); return; }
  const content = showModal('Make this conversation yours.');
  content.innerHTML = `<label class="field-label" for="rename-chat">Conversation name</label><input class="modal-input" id="rename-chat" maxlength="100" value="${escapeHTML(chat.title)}"><div class="modal-actions"><button class="danger-button" id="delete-chat">Delete chat</button><button id="save-bookmark">${chat.saved ? 'Unsave' : 'Bookmark'}</button><button class="primary" id="save-name">Save name</button></div>`;
  $('save-name').onclick = () => { const title = $('rename-chat').value.trim(); if (!title) return toast('Give this conversation a name.'); chat.title = title; persist(); renderView(); $('modal').close(); };
  $('save-bookmark').onclick = () => { chat.saved = !chat.saved; persist(); renderView(); $('modal').close(); toast(chat.saved ? 'Conversation saved.' : 'Bookmark removed.'); };
  $('delete-chat').onclick = () => { const panel = showModal('Delete this conversation?'); panel.innerHTML = '<p class="modal-intro">This removes the conversation from this browser. Export it first if you want to keep a copy.</p><div class="modal-actions"><button id="cancel-delete">Keep chat</button><button class="danger-button" id="confirm-delete">Delete permanently</button></div>'; $('cancel-delete').onclick = () => $('modal').close(); $('confirm-delete').onclick = () => { chats = chats.filter(c=>c.id!==chat.id); if(activeId===chat.id) activeId=null; persist(); renderView(); $('modal').close(); toast('Conversation deleted.'); }; };
}
async function checkStatus() {
  try { const response = await fetch('/api/status', {signal:AbortSignal.timeout(6000)}); if (!response.ok) throw new Error(); status = await response.json();
    if (settings.model !== status.default_model) { settings.model = status.default_model; saveSettings(); }
    $('status-dot').className = 'status-dot ' + (status.connected ? 'online' : 'offline');
    $('model-label').textContent = settings.model || 'Local AI';
    $('model-button').title = status.connected ? `${status.provider} connected · Model settings` : `${status.provider} is not configured · Open setup`;
  } catch { $('status-dot').className = 'status-dot offline'; $('model-label').textContent = 'Reconnect'; }
}
async function openSettings() {
  const content = showModal('A buddy, on your terms.', 'SETTINGS');
  content.innerHTML = '<p class="modal-intro">Checking your local AI connection…</p>';
  await checkStatus(); if (!$('modal').open || $('modal-title').textContent !== 'A buddy, on your terms.') return;
  content.innerHTML = `<div class="settings-status"><span class="status-dot ${status.connected ? 'online' : 'offline'}"></span>${status.connected ? 'NVIDIA connected' : 'NVIDIA API key required'}</div>
    <label class="field-label" for="model-select">AI model</label><input class="modal-input" id="model-select" value="${escapeHTML(status.default_model)}" readonly>
    <label class="field-label" for="temperature">Creativity</label><div class="range-row"><input id="temperature" type="range" min="0" max="2" step="0.1" value="${Number(settings.temperature) || 0}"><output id="temperature-output">${Number(settings.temperature) || 0}</output></div><p class="file-note">Lower for focused answers. Higher for more varied ideas.</p>
    <div class="setup-note"><strong>NVIDIA cloud model</strong><br>Rai Buddy uses ${escapeHTML(status.default_model)}. The model is fixed on the server and the NVIDIA API key is never sent to your browser.</div>
    <p class="file-note">Chats and preferences are saved only in this browser. Clearing browser data removes them. Messages and attached text are sent through Rai Buddy's configured AI provider.</p>
    <div class="modal-actions"><button id="refresh-connection">Recheck connection</button><button class="primary" id="save-settings">Save preferences</button></div>`;
  $('temperature').oninput = () => $('temperature-output').textContent = $('temperature').value;
  $('refresh-connection').onclick = openSettings;
  $('save-settings').onclick = () => { settings.model=status.default_model; settings.temperature=Number($('temperature').value); saveSettings(); $('model-label').textContent=status.default_model; $('modal').close(); toast('Preferences saved.'); };
}
function renderAttachment() {
  $('attachment-preview').hidden = !attachment; $('attachment-preview').replaceChildren();
  if (attachment) { const label=document.createElement('span'); label.textContent=`${attachment.name} · ${(attachment.size/1024).toFixed(1)} KB`; const remove=document.createElement('button'); remove.className='icon-button'; remove.innerHTML=icon('x'); remove.type='button'; remove.setAttribute('aria-label','Remove attachment'); remove.onclick=()=>{attachment=null;renderAttachment();}; $('attachment-preview').append(label,remove); }
}
async function submit(event) {
  event?.preventDefault(); if(controller) { controller.abort(); return; }
  const text = $('prompt').value.trim(); if(!text && !attachment) return $('prompt').focus();
  const content = (text || 'Please summarize this file.') + (attachment ? `\n\nAttached file: ${attachment.name}\n<file-content>\n${attachment.text}\n</file-content>` : '');
  let chat=currentChat();
  if(!chat) { chat={id:crypto.randomUUID(),title:(text || attachment.name).slice(0,55),messages:[],updated:Date.now(),saved:false}; chats.push(chat); activeId=chat.id; }
  if(chat.messages.length>=198) return toast('This chat is full. Start a new chat to keep exploring.');
  chat.messages.push({role:'user',content,display:text+(attachment ? `\n📎 ${attachment.name}` : ''),time:Date.now()});
  chat.updated=Date.now(); $('prompt').value=''; attachment=null; $('file-input').value=''; renderAttachment(); persist(); await generate(chat);
}
async function generate(chat) {
  if(controller) return;
  controller=new AbortController(); const signal=controller.signal;
  const history=chat.messages.filter(m=>m.content && !m.error && !m.stopped).map(({role,content})=>({role,content}));
  const answer={role:'assistant',content:'',time:Date.now()}; chat.messages.push(answer);
  $('send-button').innerHTML=icon('stop'); $('send-button').setAttribute('aria-label','Stop generating'); $('enter-hint').textContent='Stop response';
  $('prompt').disabled=true; $('attach-button').disabled=true; renderView();
  const followScroll = () => { if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-240) window.scrollTo({top:document.body.scrollHeight}); };
  window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
  let completed=false;
  try {
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,model:settings.model || status.default_model,temperature:Number(settings.temperature) || 0}),signal});
    if(!response.ok) { const body=await response.json(); throw new Error(body.error || 'Could not send this message. Please try again.'); }
    const reader=response.body.getReader(); const decoder=new TextDecoder(); let buffer='';
    const consume=line=> { if(!line.trim())return; const item=JSON.parse(line); if(item.error)throw new Error(item.error); answer.content+=item.content || ''; if(item.done)completed=true; };
    while(true) { const {done,value}=await reader.read(); if(done)break; buffer+=decoder.decode(value,{stream:true}); const lines=buffer.split('\n'); buffer=lines.pop(); lines.forEach(consume); renderMessages(); followScroll(); }
    buffer+=decoder.decode(); if(buffer.trim())consume(buffer);
    if(!completed) throw new Error('The reply ended early. Please try again.');
    if(!answer.content.trim()) throw new Error('This model returned an empty reply. Try again or choose another model.');
  } catch(error) { if(error.name==='AbortError') answer.stopped=true; else answer.error=error.message || 'Connection interrupted. Please try again.'; }
  finally { controller=null; $('send-button').innerHTML=icon('arrow-up'); $('send-button').setAttribute('aria-label','Send message'); $('enter-hint').textContent='Enter to send'; $('prompt').disabled=false; $('attach-button').disabled=false; chat.updated=Date.now(); persist(); renderMessages(); renderHistory(); $('prompt').focus({preventScroll:true}); followScroll(); }
}
export function initApp() {
icons(); applyTheme(); renderPrompts(); renderView(); checkStatus();
$('new-chat').onclick=newChat; $('history-new').onclick=newChat;
$('nav-chats').onclick=()=>{savedOnly=false;renderHistory();}; $('nav-saved').onclick=()=>{savedOnly=true;renderHistory();};
$('nav-library').onclick=openLibrary; $('prompts-button').onclick=openLibrary; $('search-button').onclick=openSearch;
$('settings-button').onclick=openSettings; $('model-button').onclick=openSettings;
$('theme-button').onclick=()=>{settings.dark=!settings.dark;applyTheme();saveSettings();};
$('shuffle-prompts').onclick=()=>{promptSet=(promptSet+1)%3;renderPrompts();};
$('menu-button').onclick=()=>{$('sidebar').classList.add('open');$('sidebar-scrim').classList.add('open');}; $('sidebar-scrim').onclick=closeSidebar;
$('close-modal').onclick=()=>$('modal').close(); $('modal').onclick=e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}};
$('chat-form').onsubmit=submit;
$('prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('modal').close();newChat();}if(e.key==='Escape')closeSidebar();});
$('attach-button').onclick=()=>$('file-input').click();
$('file-input').onchange=async()=>{const file=$('file-input').files[0];if(!file)return;const allowed=/\.(txt|md|csv|json|py|js|ts|html|css|xml|yaml|yml|log)$/i;if(!allowed.test(file.name)){toast('Choose a text or code file. PDF and images are not supported yet.');$('file-input').value='';return;}if(file.size>100*1024){toast('Please choose a text file smaller than 100 KB.');$('file-input').value='';return;}try{const text=await file.text();if(text.includes('\u0000'))throw new Error();attachment={name:file.name,text,size:file.size};renderAttachment();$('prompt').focus();}catch{toast('This file could not be read as text.');}finally{$('file-input').value='';}};
window.addEventListener('beforeunload',e=>{if(controller){e.preventDefault();e.returnValue='';}});
}
