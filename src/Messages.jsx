import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, Send, Users, Plus, Settings, ArrowLeft, UserPlus, UserMinus, Check } from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Private messaging — DMs and group chats.                               */
/* Uses the existing Supabase kv storage + the existing session auth.     */
/* Keys:                                                                  */
/*   dm-index            → array of conversations (shared)                */
/*   dm-msgs:{convId}    → array of messages (shared)                     */
/*   dm-typing:{convId}  → { username: lastTypedTs } (shared)             */
/*   dm-read:{convId}    → last-read timestamp (local, per browser)       */
/* ---------------------------------------------------------------------- */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function msgTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? hm : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${hm}`;
}

const MAX_MSGS = 300;
const TYPING_TTL = 5000;

async function loadIndex(storage) {
  try {
    const r = await storage.get("dm-index", true);
    return r && r.value ? JSON.parse(r.value) : [];
  } catch (e) {
    return [];
  }
}

async function saveIndex(storage, list) {
  try {
    await storage.set("dm-index", JSON.stringify(list), true);
  } catch (e) {}
}

async function loadMsgs(storage, convId) {
  try {
    const r = await storage.get(`dm-msgs:${convId}`, true);
    return r && r.value ? JSON.parse(r.value) : [];
  } catch (e) {
    return [];
  }
}

function convTitle(conv, me) {
  if (conv.type === "group") return conv.name || "Group";
  const other = (conv.members || []).find((m) => m !== me);
  return other ? `@${other}` : "@" + (conv.members || [])[0];
}

export default function MessagesPanel({ open, onClose, session, users, storage, showToast }) {
  const me = session ? session.username : null;

  const [convs, setConvs] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [screen, setScreen] = useState("list"); // list | new | newGroup | conv | settings
  const [userSearch, setUserSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupPick, setGroupPick] = useState([]);
  const [renameDraft, setRenameDraft] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const bottomRef = useRef(null);
  const lastTypedSentRef = useRef(0);

  const activeConv = convs.find((c) => c.id === activeId) || null;
  const myConvs = convs.filter((c) => me && (c.members || []).includes(me));

  const getReadTs = useCallback(async (convId) => {
    const r = await storage.get(`dm-read:${convId}`, false);
    return r && r.value ? Number(r.value) : 0;
  }, [storage]);

  const markRead = useCallback(async (convId) => {
    await storage.set(`dm-read:${convId}`, String(Date.now()), false);
    setUnreadMap((prev) => ({ ...prev, [convId]: 0 }));
  }, [storage]);

  /* ---- poll conversation index + unread counts ---- */
  useEffect(() => {
    if (!open || !me) return;
    let active = true;
    async function poll() {
      const list = await loadIndex(storage);
      if (!active) return;
      setConvs(list);
      const mine = list.filter((c) => (c.members || []).includes(me));
      const counts = {};
      await Promise.all(
        mine.map(async (c) => {
          const readTs = await getReadTs(c.id);
          if (!c.lastMessage || c.lastMessage.at <= readTs || c.lastMessage.author === me) {
            counts[c.id] = 0;
            return;
          }
          const msgs = await loadMsgs(storage, c.id);
          counts[c.id] = msgs.filter((m) => m.createdAt > readTs && m.author !== me).length;
        })
      );
      if (active) setUnreadMap(counts);
    }
    poll();
    const iv = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [open, me, storage, getReadTs]);

  /* ---- poll active conversation messages + typing ---- */
  useEffect(() => {
    if (!open || !activeId || !me) return;
    let active = true;
    async function poll() {
      const msgs = await loadMsgs(storage, activeId);
      if (!active) return;
      setMessages(msgs);
      markRead(activeId);
      try {
        const r = await storage.get(`dm-typing:${activeId}`, true);
        const map = r && r.value ? JSON.parse(r.value) : {};
        const now = Date.now();
        if (active) setTypingUsers(Object.keys(map).filter((u) => u !== me && now - map[u] < TYPING_TTL));
      } catch (e) {}
    }
    poll();
    const iv = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [open, activeId, me, storage, markRead]);

  useEffect(() => {
    if (screen === "conv" && bottomRef.current) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end" }), 80);
    }
  }, [screen, messages.length]);

  if (!open) return null;

  if (!session) {
    return (
      <>
        <div className="chat-backdrop" onClick={onClose} />
        <div className="chat-drawer chat-drawer-open">
          <div className="chat-drawer-inner">
            <div className="chat-header">
              <p className="font-logo text-fog text-base tracking-tight">Messages</p>
              <button onClick={onClose} className="modal-close" style={{ position: "static" }} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="text-dim text-sm text-center mt-10 px-4">Log in to send private messages.</p>
          </div>
        </div>
      </>
    );
  }

  const allUsernames = Object.keys(users).filter((u) => u !== me);
  const searchResults = userSearch.trim()
    ? allUsernames.filter((u) => u.toLowerCase().includes(userSearch.trim().toLowerCase()))
    : allUsernames.slice(0, 20);
  const addResults = addSearch.trim()
    ? allUsernames.filter((u) => u.toLowerCase().includes(addSearch.trim().toLowerCase()) && !(activeConv?.members || []).includes(u))
    : [];

  async function openOrCreateDm(other) {
    const list = await loadIndex(storage);
    let conv = list.find((c) => c.type === "dm" && c.members.includes(me) && c.members.includes(other));
    if (!conv) {
      conv = { id: generateId(), type: "dm", members: [me, other], createdBy: me, createdAt: Date.now(), lastMessage: null };
      const next = [conv, ...list];
      setConvs(next);
      await saveIndex(storage, next);
    } else {
      setConvs(list);
    }
    setActiveId(conv.id);
    setMessages(await loadMsgs(storage, conv.id));
    setScreen("conv");
    setUserSearch("");
  }

  async function createGroup() {
    const name = groupName.trim();
    if (!name) return showToast("Give the group a name.");
    if (groupPick.length === 0) return showToast("Add at least one member.");
    const conv = { id: generateId(), type: "group", name, members: [me, ...groupPick], createdBy: me, createdAt: Date.now(), lastMessage: null };
    const list = await loadIndex(storage);
    const next = [conv, ...list];
    setConvs(next);
    await saveIndex(storage, next);
    setActiveId(conv.id);
    setMessages([]);
    setScreen("conv");
    setGroupName("");
    setGroupPick([]);
    setUserSearch("");
    showToast(`Group "${name}" created.`);
  }

  async function updateConv(convId, updater) {
    const list = await loadIndex(storage);
    const next = list.map((c) => (c.id === convId ? updater(c) : c));
    setConvs(next);
    await saveIndex(storage, next);
    return next.find((c) => c.id === convId);
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;
    const msg = { id: generateId(), author: me, text: text.slice(0, 500), createdAt: Date.now() };
    const fresh = await loadMsgs(storage, activeId);
    const next = [...fresh, msg].slice(-MAX_MSGS);
    setMessages(next);
    setDraft("");
    try {
      await storage.set(`dm-msgs:${activeId}`, JSON.stringify(next), true);
      await updateConv(activeId, (c) => ({ ...c, lastMessage: { author: me, text: msg.text.slice(0, 80), at: msg.createdAt } }));
      markRead(activeId);
    } catch (e2) {
      showToast("Message couldn't save — try again.");
    }
  }

  async function signalTyping() {
    if (!activeId) return;
    const now = Date.now();
    if (now - lastTypedSentRef.current < 2500) return;
    lastTypedSentRef.current = now;
    try {
      const r = await storage.get(`dm-typing:${activeId}`, true);
      const map = r && r.value ? JSON.parse(r.value) : {};
      map[me] = now;
      Object.keys(map).forEach((u) => { if (now - map[u] > 30000) delete map[u]; });
      await storage.set(`dm-typing:${activeId}`, JSON.stringify(map), true);
    } catch (e) {}
  }

  async function renameGroup() {
    const name = renameDraft.trim();
    if (!name || !activeConv) return;
    await updateConv(activeConv.id, (c) => ({ ...c, name }));
    setRenameDraft("");
    showToast("Group renamed.");
  }

  async function addMember(u) {
    if (!activeConv) return;
    await updateConv(activeConv.id, (c) => (c.members.includes(u) ? c : { ...c, members: [...c.members, u] }));
    setAddSearch("");
    showToast(`@${u} added to the group.`);
  }

  async function removeMember(u) {
    if (!activeConv) return;
    const updated = await updateConv(activeConv.id, (c) => ({ ...c, members: c.members.filter((m) => m !== u) }));
    if (u === me) {
      setScreen("list");
      setActiveId(null);
      showToast("You left the group.");
    } else {
      showToast(`@${u} removed from the group.`);
    }
    return updated;
  }

  const header = (title, backTo, right) => (
    <div className="chat-header">
      <div className="flex items-center gap-2 min-w-0">
        {backTo && (
          <button onClick={() => setScreen(backTo)} className="icon-toggle-btn" aria-label="Back"><ArrowLeft size={16} /></button>
        )}
        <p className="font-logo text-fog text-base tracking-tight truncate">{title}</p>
      </div>
      <div className="flex items-center gap-1">
        {right}
        <button onClick={onClose} className="modal-close" style={{ position: "static" }} aria-label="Close"><X size={18} /></button>
      </div>
    </div>
  );

  return (
    <>
      <div className="chat-backdrop" onClick={onClose} />
      <div className="chat-drawer chat-drawer-open">
        <div className="chat-drawer-inner">
          {screen === "list" && (
            <>
              {header("Messages", null, (
                <>
                  <button onClick={() => { setScreen("new"); setUserSearch(""); }} className="icon-toggle-btn" title="New message" aria-label="New message"><Plus size={16} /></button>
                  <button onClick={() => { setScreen("newGroup"); setUserSearch(""); setGroupPick([]); setGroupName(""); }} className="icon-toggle-btn" title="New group" aria-label="New group"><Users size={16} /></button>
                </>
              ))}
              <div className="chat-messages-area">
                {myConvs.length === 0 && (
                  <p className="text-dim text-sm text-center mt-10 px-4">No conversations yet — start one with the + button.</p>
                )}
                {myConvs
                  .slice()
                  .sort((a, b) => (b.lastMessage?.at || b.createdAt) - (a.lastMessage?.at || a.createdAt))
                  .map((c) => (
                    <button key={c.id} onClick={() => { setActiveId(c.id); setScreen("conv"); }} className="dm-conv-row w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-logo text-fog text-sm tracking-tight truncate flex items-center gap-1.5">
                          {c.type === "group" && <Users size={12} className="text-dim shrink-0" />}
                          {convTitle(c, me)}
                          {c.type === "group" && <span className="mono-label text-dim">· {c.members.length}</span>}
                        </p>
                        <span className="mono-label text-dim shrink-0">{timeAgo(c.lastMessage?.at || c.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-dim text-xs truncate">
                          {c.lastMessage ? `${c.lastMessage.author === me ? "You" : "@" + c.lastMessage.author}: ${c.lastMessage.text}` : "No messages yet"}
                        </p>
                        {(unreadMap[c.id] || 0) > 0 && <span className="dm-unread-badge">{unreadMap[c.id]}</span>}
                      </div>
                    </button>
                  ))}
              </div>
            </>
          )}

          {screen === "new" && (
            <>
              {header("New message", "list")}
              <div className="chat-messages-area">
                <div className="search-bar mb-3">
                  <Search size={14} className="text-dim" />
                  <input autoFocus value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search username…" className="bg-transparent outline-none text-sm text-fog placeholder:text-dim flex-1" />
                </div>
                {searchResults.length === 0 && <p className="text-dim text-sm text-center mt-6">No users found.</p>}
                {searchResults.map((u) => (
                  <button key={u} onClick={() => openOrCreateDm(u)} className="dm-conv-row w-full text-left">
                    <p className="font-logo text-fog text-sm tracking-tight">@{u}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {screen === "newGroup" && (
            <>
              {header("New group", "list")}
              <div className="chat-messages-area">
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="field-input mb-3" />
                <div className="search-bar mb-3">
                  <Search size={14} className="text-dim" />
                  <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search members…" className="bg-transparent outline-none text-sm text-fog placeholder:text-dim flex-1" />
                </div>
                {groupPick.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {groupPick.map((u) => (
                      <button key={u} onClick={() => setGroupPick(groupPick.filter((x) => x !== u))} className="tag-chip">@{u} ×</button>
                    ))}
                  </div>
                )}
                {searchResults.map((u) => (
                  <button
                    key={u}
                    onClick={() => setGroupPick(groupPick.includes(u) ? groupPick.filter((x) => x !== u) : [...groupPick, u])}
                    className="dm-conv-row w-full text-left flex items-center justify-between"
                  >
                    <p className="font-logo text-fog text-sm tracking-tight">@{u}</p>
                    {groupPick.includes(u) && <Check size={14} className="text-red" />}
                  </button>
                ))}
                <button onClick={createGroup} className="btn-primary w-full mt-4">Create group</button>
              </div>
            </>
          )}

          {screen === "conv" && activeConv && (
            <>
              {header(convTitle(activeConv, me), "list", activeConv.type === "group" && (
                <button onClick={() => { setScreen("settings"); setRenameDraft(activeConv.name || ""); setAddSearch(""); }} className="icon-toggle-btn" title="Group settings" aria-label="Group settings"><Settings size={16} /></button>
              ))}
              <div className="chat-messages-area">
                {messages.length === 0 && <p className="text-dim text-sm text-center mt-10">No messages yet — say hi.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble ${m.author === me ? "chat-bubble-mine" : ""}`}>
                    <p className="mono-label text-dim">@{m.author} · {msgTime(m.createdAt)}</p>
                    <p className="text-fog text-sm mt-0.5">{m.text}</p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              {typingUsers.length > 0 && (
                <p className="mono-label text-dim px-4 pb-1 dm-typing">
                  {typingUsers.map((u) => `@${u}`).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
                </p>
              )}
              <div className="chat-input-row">
                <form onSubmit={sendMessage} className="flex gap-2 w-full">
                  <input
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); signalTyping(); }}
                    placeholder="Message…"
                    className="field-input flex-1"
                    style={{ borderRadius: 999 }}
                  />
                  <button type="submit" className="btn-primary-sm" style={{ borderRadius: 999, padding: "8px 14px" }} aria-label="Send">
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </>
          )}

          {screen === "settings" && activeConv && activeConv.type === "group" && (
            <>
              {header("Group settings", "conv")}
              <div className="chat-messages-area">
                <p className="mono-label text-dim mb-1.5">GROUP NAME</p>
                <div className="flex gap-2 mb-5">
                  <input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} className="field-input flex-1" />
                  <button onClick={renameGroup} className="btn-primary-sm">Rename</button>
                </div>

                <p className="mono-label text-dim mb-1.5">MEMBERS — {activeConv.members.length}</p>
                <div className="space-y-1 mb-5">
                  {activeConv.members.map((u) => (
                    <div key={u} className="dm-conv-row flex items-center justify-between">
                      <p className="font-logo text-fog text-sm tracking-tight">
                        @{u} {u === activeConv.createdBy && <span className="mono-label text-dim">· owner</span>}
                      </p>
                      {(u === me || me === activeConv.createdBy) && u !== activeConv.createdBy && (
                        <button onClick={() => removeMember(u)} className="icon-toggle-btn hover:text-red" title={u === me ? "Leave group" : "Remove"} aria-label="Remove member">
                          <UserMinus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <p className="mono-label text-dim mb-1.5">ADD MEMBER</p>
                <div className="search-bar mb-2">
                  <UserPlus size={14} className="text-dim" />
                  <input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Search username…" className="bg-transparent outline-none text-sm text-fog placeholder:text-dim flex-1" />
                </div>
                {addResults.map((u) => (
                  <button key={u} onClick={() => addMember(u)} className="dm-conv-row w-full text-left">
                    <p className="font-logo text-fog text-sm tracking-tight">@{u}</p>
                  </button>
                ))}

                {me !== activeConv.createdBy && (
                  <button onClick={() => removeMember(me)} className="btn-ghost w-full mt-5 justify-center">Leave group</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
