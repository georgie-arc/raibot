import { useEffect } from 'react';
import { initApp } from './uiController.js';

const Logo = ({ className = '', alt = '' }) => <span className={`${className} logo-crop`}><img src="/assets/kmitl-logo.png" alt={alt} /></span>;

export default function App() {
  useEffect(() => initApp(), []);
  return <div className="app-shell">
    <aside className="sidebar" id="sidebar" aria-label="Workspace navigation">
      <a className="brand" href="/" aria-label="Rai Buddy home"><Logo className="brand-logo" alt="KMITL" /><span>Rai <span className="brand-light">Buddy</span><span className="brand-dot">.</span></span></a>
      <button className="new-chat primary" id="new-chat"><span data-icon="plus" /> New chat <kbd>Ctrl K</kbd></button>
      <button className="search-button" id="search-button"><span data-icon="search" /> Search conversations <kbd>⌕</kbd></button>
      <nav className="main-nav" aria-label="Main navigation">
        <button className="nav-item active" id="nav-chats"><span data-icon="chat" /> All chats <span className="nav-count" id="chat-count">0</span></button>
        <button className="nav-item" id="nav-library"><span data-icon="grid" /> Prompt library <span className="tiny-badge">12</span></button>
        <button className="nav-item" id="nav-saved"><span data-icon="bookmark" /> Saved chats</button>
      </nav>
      <div className="history-heading"><span id="history-label">RECENT CONVERSATIONS</span><button className="icon-button" id="history-new" aria-label="Start a new conversation" data-icon="plus" /></div>
      <div className="history" id="history" />
      <div className="sidebar-bottom">
        <div className="local-card"><span className="local-icon" data-icon="shield" /><div><strong>Your space. Your pace.</strong><p>No account. Just possibilities.</p></div><span className="green-dot" /></div>
        <button className="settings-button" id="settings-button"><span data-icon="settings" /> Settings <span className="version">v3.0</span></button>
      </div>
    </aside>
    <button className="sidebar-scrim" id="sidebar-scrim" aria-label="Close navigation" />
    <main className="main">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button mobile-menu" id="menu-button" data-icon="menu" aria-label="Open navigation" /><span className="breadcrumb">Workspace</span><span className="breadcrumb-slash">/</span><span className="page-title" id="page-title">New conversation</span></div>
        <div className="topbar-right"><button className="model-pill" id="model-button"><span className="status-dot" id="status-dot" /><span id="model-label">Connecting…</span><span data-icon="chevron" /></button><button className="icon-button" id="theme-button" data-icon="moon" aria-label="Toggle dark theme" /></div>
      </header>
      <div className="workspace" id="workspace">
        <section className="welcome" id="welcome">
          <div className="welcome-kicker"><span /> A LITTLE CURIOSITY GOES A LONG WAY</div>
          <Logo className="hero-mark" alt="KMITL logo" />
          <h1>Good things start with<br />a little <span>“what if?”</span></h1>
          <p className="hero-description">Meet Rai Buddy. Your thinking partner for big ideas,<br className="desktop-break" /> small questions, and everything in between.</p>
        </section>
        <section className="conversation" id="conversation" aria-label="Conversation" aria-live="polite" hidden />
        <div className="compose-area" id="compose-area">
          <form className="composer" id="chat-form">
            <div className="composer-label"><span data-icon="sparkles" /> A fresh thought starts here</div>
            <div className="attachment-preview" id="attachment-preview" hidden />
            <textarea id="prompt" rows="3" maxLength="24000" placeholder="Ask a question, or let’s make something great…" aria-label="Message Rai Buddy" />
            <div className="composer-bottom"><div className="composer-tools"><button type="button" className="tool-button" id="attach-button" title="Attach a text or code file"><span data-icon="paperclip" /><span>Attach file</span></button><span className="tool-divider" /><button type="button" className="tool-button" id="prompts-button"><span data-icon="grid" /><span>Prompts</span></button></div><div className="send-tools"><span className="enter-hint" id="enter-hint">Enter to send</span><button type="submit" className="send-button" id="send-button" aria-label="Send message"><span data-icon="arrow-up" /></button></div></div>
          </form>
          <input type="file" id="file-input" accept=".txt,.md,.csv,.json,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.log" hidden />
          <div className="composer-footnote"><span data-icon="shield" /> Just you and your ideas. Chats stay in this browser.</div>
        </div>
        <section className="suggestions" id="suggestions">
          <div className="suggestions-heading"><span>NOT SURE WHERE TO START?</span><button id="shuffle-prompts"><span data-icon="shuffle" /> A little inspiration</button></div>
          <div className="prompt-grid" id="prompt-grid" />
          <div className="welcome-footer"><span className="footer-line" /><span>Built for curious minds. Like yours.</span><span className="footer-line" /></div>
        </section>
      </div>
      <footer className="main-footer"><span><Logo className="mini-mark" /> A buddy for your everyday brilliance.</span><span>Rai Buddy can make mistakes. Stay curious, double-check.</span></footer>
    </main>
    <dialog id="modal"><div className="modal-header"><div><div className="modal-eyebrow" id="modal-eyebrow">YOUR WORKSPACE</div><h2 id="modal-title" /></div><button className="icon-button" id="close-modal" data-icon="x" aria-label="Close dialog" /></div><div id="modal-content" /></dialog>
    <div className="toast" id="toast" role="status" hidden />
  </div>;
}
