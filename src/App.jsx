import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Download,
  Upload as UploadIcon,
  LogOut,
  Search,
  Heart,
  Film,
  X,
  Trash2,
  Menu,
  MessageCircle,
  Bookmark,
  Star,
  Shuffle,
  Sun,
  Moon,
  Contrast,
  BadgeCheck,
  Flag,
  UserX,
  Users,
  Pin,
  Bell,
  Camera,
  Settings,
  Send,
  Award,
} from "lucide-react";

import AnimeEpisodes from './AnimeEpisodes';

/* ---------------------------------------------------------------------- */
/* Supabase persistent storage — replaces in-page window.storage          */
/* ---------------------------------------------------------------------- */

const SUPABASE_URL = "https://jgbpkfbuhttmqpsvynul.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnYnBrZmJ1aHR0bXFwc3Z5bnVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNDYxNDYsImV4cCI6MjA5ODgyMjE0Nn0.0rEg1rRFJxpIffVuLjh8-pimgGIcRTympU9n446meBs";

const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates",
};

// Drop-in replacement for window.storage
// shared=true  → Supabase (global, permanent, all users share it)
// shared=false → localStorage (private to this browser/user)
const supabaseStorage = {
  async get(key, shared = false) {
    if (!shared) {
      try {
        const v = localStorage.getItem(`av:${key}`);
        return v !== null ? { key, value: v, shared: false } : null;
      } catch (e) { return null; }
    }
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/kv?key=eq.${encodeURIComponent(key)}&select=value`,
        { headers: SB_HEADERS }
      );
      const rows = await r.json();
      return Array.isArray(rows) && rows.length > 0 ? { key, value: rows[0].value, shared: true } : null;
    } catch (e) { return null; }
  },

  async set(key, value, shared = false) {
    if (!shared) {
      try {
        localStorage.setItem(`av:${key}`, value);
        return { key, value, shared: false };
      } catch (e) { return null; }
    }
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/kv`, {
        method: "POST",
        headers: SB_HEADERS,
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      });
      return { key, value, shared: true };
    } catch (e) { return null; }
  },

  async delete(key, shared = false) {
    if (!shared) {
      try { localStorage.removeItem(`av:${key}`); } catch (e) {}
      return { key, deleted: true };
    }
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/kv?key=eq.${encodeURIComponent(key)}`,
        { method: "DELETE", headers: SB_HEADERS }
      );
      return { key, deleted: true };
    } catch (e) { return null; }
  },
};

// Compatibility layer for old window.storage calls
window.storage = {
  async get(key) {
    return await supabaseStorage.get(key, true);
  },

  async set(key, value) {
    return await supabaseStorage.set(key, value, true);
  },

  async remove(key) {
    return await supabaseStorage.delete(key, true);
  }
};

/* ---------------------------------------------------------------------- */
/* constants                                                               */
/* ---------------------------------------------------------------------- */

// Add admin usernames here (lowercase). You can add up to 5.
const ADMIN_USERNAMES = ["uzzy"]; // e.g. ["uzzy", "name2", "name3"]
// Keep backwards-compat alias
const ADMIN_USERNAME = ADMIN_USERNAMES[0];

// ── Cloudinary direct upload (FREE at cloudinary.com) ──────────────────────
// 1. Sign up free at cloudinary.com
// 2. Go to Settings → Upload → Add upload preset → set to "Unsigned" → save
// 3. Paste your cloud name and preset name below
const CLOUDINARY_CLOUD_NAME = ""; // e.g. "dxabcde123"
const CLOUDINARY_UPLOAD_PRESET = ""; // e.g. "animevault_unsigned"
const CLOUDINARY_ENABLED = !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

// ── Real-time chat backend (the animevault-backend project) ────────────────
// Deploy animevault-backend (see its README) then paste its live URL here.
// While this is empty, chat automatically falls back to Supabase polling
// (still shared and working, just refreshes every 4s instead of instantly).
const BACKEND_URL = ""; // e.g. "https://animevault-backend.onrender.com"
const REALTIME_CHAT_ENABLED = !!BACKEND_URL;

async function uploadToCloudinary(file, onProgress) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  fd.append("resource_type", "video");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (d.secure_url) resolve(d.secure_url);
        else reject(new Error(d.error?.message || "Upload failed"));
      } catch (e) { reject(e); }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`);
    xhr.send(fd);
  });
}

const ANIME_CATEGORIES = [
  "Demon Slayer",
  "Bleach",
  "Jujutsu Kaisen",
  "Attack on Titan",
  "One Piece",
  "Naruto",
  "Chainsaw Man",
  "My Hero Academia",
];
const GAME_CATEGORIES = ["Genshin Impact", "Wuthering Waves", "Tower of Fantasy", "Honkai Star Rail"];
const WALLPAPER_CATEGORIES = [...ANIME_CATEGORIES, ...GAME_CATEGORIES, "Other"];
const WALLPAPER_KINDS = ["Phone", "Desktop", "Live"];
const WALLPAPER_STYLES = ["Dark", "Aesthetic", "AMOLED", "Minimal", "4K"];
const ORIENTATIONS = ["Portrait", "Landscape"];
const EDIT_CATEGORIES = ["AMV", "Character Edit", "Manga Panel"];
const QUICK_EDIT_TAGS = ["AMV", "Velocity", "Shake", "Slow Motion", "4K", "HD"];

const ANIME_SHOWS = [
  "Demon Slayer", "Bleach", "Jujutsu Kaisen", "Attack on Titan",
  "One Piece", "Naruto", "Naruto: Shippuden", "Chainsaw Man",
  "My Hero Academia", "Dragon Ball Z", "Dragon Ball Super",
  "Fullmetal Alchemist: Brotherhood", "Sword Art Online", "Tokyo Revengers",
  "Hunter x Hunter", "Death Note", "Vinland Saga", "Spy x Family",
  "Re:Zero", "Overlord", "Black Clover", "Fairy Tail",
  "Gintama", "Haikyuu", "Slam Dunk", "Berserk",
  "Neon Genesis Evangelion", "Cowboy Bebop", "Steins;Gate",
  "Your Lie in April", "A Silent Voice", "Mob Psycho 100",
  "Blue Lock", "Oshi no Ko", "Frieren", "Dungeon Meshi",
];
const ANIME_SUBTABS = ["Episodes", "Trending", "News"];
const EDIT_STYLES = ["AMV", "Velocity", "Shake", "Slow Motion", "Cinematic", "Sync Edit", "Phonk", "Glitch"];

const MAX_VIDEO_BYTES = 3.6 * 1024 * 1024; // hard ceiling: this page's storage caps every item at 5MB

// Basic, client-side word filter for chat — not real moderation, just a first pass.
const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "cunt", "whore", "slut", "bastard",
  "nigger", "faggot", "retard", "porn", "nude", "nsfw", "rape",
];
function filterMessage(text) {
  let out = text;
  BLOCKED_WORDS.forEach((w) => {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    out = out.replace(re, (m) => "*".repeat(m.length));
  });
  return out;
}

const GRADIENTS = [
  ["from-red-700", "to-neutral-900"],
  ["from-rose-700", "to-stone-900"],
  ["from-orange-700", "to-red-950"],
  ["from-red-800", "to-zinc-900"],
  ["from-amber-700", "to-stone-950"],
  ["from-red-600", "to-neutral-950"],
];

const PETALS = [
  { left: "8%", duration: "9s", delay: "0s" },
  { left: "22%", duration: "11s", delay: "2s" },
  { left: "37%", duration: "8.5s", delay: "4s" },
  { left: "55%", duration: "10s", delay: "1s" },
  { left: "68%", duration: "9.5s", delay: "3s" },
  { left: "81%", duration: "11.5s", delay: "5s" },
  { left: "92%", duration: "8s", delay: "2.5s" },
];

/* ---------------------------------------------------------------------- */
/* helpers                                                                 */
/* ---------------------------------------------------------------------- */

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function gradientFor(seed) {
  const pair = GRADIENTS[hashStr(seed) % GRADIENTS.length];
  return `bg-gradient-to-br ${pair[0]} ${pair[1]}`;
}

const AVATAR_COLORS = ["#E8283F", "#C2410C", "#A21CAF", "#0E7490", "#4D7C0F", "#B45309"];
function avatarColorFor(username) {
  return AVATAR_COLORS[hashStr(username) % AVATAR_COLORS.length];
}

// NOT a secure hash. This is a demo app with no backend — don't reuse a real password.
function weakHash(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function pad5(n) {
  return String(Math.max(0, Math.floor(n))).padStart(5, "0");
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

// Resizes + compresses an image file client-side so it fits comfortably in storage.
function resizeImageFile(file, maxDim = 1000, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Reads a file (e.g. a short video clip) straight to a data URL — no resizing, since canvas
// can't shrink video the way it shrinks images. Caller is responsible for checking file size first.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pushNotification(targetUsername, notif) {
  if (!targetUsername) return;
  try {
    const r = await supabaseStorage.get(`notifications:${targetUsername}`, true);
    const list = r ? JSON.parse(r.value) : [];
    list.unshift({ id: generateId(), createdAt: Date.now(), read: false, ...notif });
    await supabaseStorage.set(`notifications:${targetUsername}`, JSON.stringify(list.slice(0, 50)), true);
  } catch (e) {}
}

function handleTiltMove(e) {
  if (prefersReducedMotion()) return;
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  card.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-3px)`;
}
function handleTiltLeave(e) {
  e.currentTarget.style.transform = "";
}

/* ---------------------------------------------------------------------- */
/* small shared bits                                                      */
/* ---------------------------------------------------------------------- */

function Eyebrow({ children }) {
  return (
    <div className="eyebrow">
      <span className="eyebrow-dash" />
      {children}
    </div>
  );
}

function Logo({ size = "text-lg" }) {
  return (
    <span className="flex items-center gap-2">
      <span className="logo-mark">A</span>
      <span className={`font-logo ${size} text-fog tracking-tight`}>
        ANIME<span className="text-red">VAULT</span>
      </span>
    </span>
  );
}

function Avatar({ username, users, size = 32 }) {
  const [src, setSrc] = useState(null);
  const hasAvatar = users && users[username] && users[username].hasAvatar;

  useEffect(() => {
    let active = true;
    if (hasAvatar) {
      window.storage
        .get(`avatar-img:${username}`, true)
        .then((r) => {
          if (active && r) setSrc(r.value);
        })
        .catch(() => {});
    } else {
      setSrc(null);
    }
    return () => {
      active = false;
    };
  }, [username, hasAvatar]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="avatar-circle"
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    );
  }
  return (
    <span
      className="avatar-circle"
      style={{ width: size, height: size, fontSize: size * 0.42, background: avatarColorFor(username) }}
    >
      {username.slice(0, 1).toUpperCase()}
    </span>
  );
}

function CreatorLevel({ score }) {
  let level = null;
  if (score >= 1000) level = "Gold";
  else if (score >= 200) level = "Silver";
  else if (score >= 20) level = "Bronze";
  if (!level) return null;
  return <span className={`level-badge level-${level.toLowerCase()}`}>{level}</span>;
}

function VerifiedMark() {
  return <BadgeCheck size={13} className="text-red inline-block -mt-0.5" aria-label="Verified" />;
}

function UserChip({ username, users, onOpen, className = "" }) {
  const verified = users[username]?.verified;
  return (
    <button onClick={() => onOpen(username)} className={`mono-label text-dim hover:text-fog transition-colors inline-flex items-center gap-1 ${className}`}>
      @{username} {verified && <VerifiedMark />}
    </button>
  );
}

function SakuraBranch() {
  const blossoms = [
    [62, 56], [86, 42], [108, 66], [50, 86], [40, 60],
    [176, 32], [198, 50], [214, 26], [188, 64],
    [258, 116], [280, 100], [270, 140], [292, 124],
    [320, 200], [304, 222], [336, 212], [314, 232],
    [138, 158], [155, 142], [118, 128], [96, 150],
    [232, 176], [248, 160],
  ];
  return (
    <div className="sakura-wrap" aria-hidden="true">
      <div className="sakura-glow" />
      <svg className="sakura-branch" viewBox="0 0 400 420" fill="none">
        <path
          d="M400,420 C340,360 320,300 280,250 C250,210 230,180 180,140 C140,110 110,90 60,70 C40,60 25,50 5,38"
          stroke="#0c0e15"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path d="M280,250 C250,220 210,210 170,190 C150,180 130,172 108,168" stroke="#0c0e15" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M180,140 C160,120 130,100 95,85 C78,78 62,70 48,60" stroke="#0c0e15" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M230,180 C245,150 250,120 245,90 C242,72 240,55 244,38" stroke="#0c0e15" strokeWidth="3.5" strokeLinecap="round" />
        {blossoms.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="10" fill="#f7cdd9" opacity="0.42" />
            <circle cx={x + 9} cy={y + 3} r="8" fill="#f7cdd9" opacity="0.34" />
            <circle cx={x - 7} cy={y + 6} r="7" fill="#f7cdd9" opacity="0.34" />
            <circle cx={x + 2} cy={y - 8} r="7" fill="#fff" opacity="0.26" />
            <circle cx={x} cy={y} r="2.5" fill="#fff" opacity="0.5" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* scroll reveal                                                          */
/* ---------------------------------------------------------------------- */

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(26px)",
        transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* loading screen                                                         */
/* ---------------------------------------------------------------------- */

function LoadingScreen({ ready }) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const duration = prefersReducedMotion() ? 300 : 2200;
    function tick(now) {
      const elapsed = now - start;
      const pct = Math.min(99, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (pct < 99) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (ready && progress >= 99 && !fading) {
      setProgress(100);
      const t = setTimeout(() => setFading(true), 250);
      return () => clearTimeout(t);
    }
  }, [ready, progress, fading]);

  useEffect(() => {
    if (fading) {
      const t = setTimeout(() => setGone(true), 500);
      return () => clearTimeout(t);
    }
  }, [fading]);

  if (gone) return null;

  return (
    <div className={`loading-screen ${fading ? "loading-fade-out" : ""}`}>
      <div className="scanline-overlay" />
      <p className="loading-eyebrow">SYSTEM // ANIMEVAULT</p>
      <h1 className="glitch-title" data-text="覚醒">
        覚醒
      </h1>
      <p className="loading-sub">AWAKENING THE ARCHIVE</p>
      <div className="render-bar-track">
        <div className="render-bar-fill" style={{ width: progress + "%" }} />
      </div>
      <p className="render-label">[ {String(progress).padStart(3, "0")}% ] LOADING_FRAMES…</p>
      <div className="watermark">by Uzzy</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* edit post card + detail                                               */
/* ---------------------------------------------------------------------- */

function PostCard({ post, session, users, isAdmin, showMature, onDownload, onLike, onFavorite, onOpenDetail, onOpenProfile, onDelete, onToggleFeatured, onTogglePin, favorited, featured }) {
  const liked = session && post.likedBy.includes(session.username);
  const mine = session && post.uploader === session.username;
  const commentCount = (post.comments || []).length;
  const [revealed, setRevealed] = useState(false);
  const blurred = post.mature && !showMature && !revealed;

  return (
    <div className="cut-card group" onMouseMove={handleTiltMove} onMouseLeave={handleTiltLeave}>
      <div
        className={`thumb relative overflow-hidden rounded-md cursor-pointer ${
          featured ? "aspect-[16/10]" : "aspect-video"
        } ${post.thumbnailUrl ? "" : gradientFor(post.id)}`}
        onClick={() => (blurred ? setRevealed(true) : onOpenDetail(post.id))}
      >
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div className={`absolute inset-0 flex items-center justify-center ${blurred ? "mature-blur" : ""}`}>
          <div className="play-orb">
            <Play size={featured ? 26 : 20} className="text-white" fill="white" />
          </div>
        </div>
        {blurred && <span className="mature-label">Mature — tap to reveal</span>}
        {post.category && <span className="category-tag">{post.category}</span>}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFeatured(post);
              }}
              className={`card-icon-btn ${featured ? "text-amber-400" : ""}`}
              title="Toggle featured"
            >
              <Star size={13} fill={featured ? "currentColor" : "none"} />
            </button>
          )}
          {mine && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(post);
              }}
              className={`card-icon-btn ${post.pinned ? "text-red" : ""}`}
              title="Pin to profile"
            >
              <Pin size={13} fill={post.pinned ? "currentColor" : "none"} />
            </button>
          )}
          {mine && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(post);
              }}
              className="card-icon-btn opacity-0 group-hover:opacity-100 hover:text-red"
              aria-label="Delete edit"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="px-1 pt-3">
        <h3 className="font-logo text-fog text-base leading-tight truncate tracking-tight cursor-pointer" onClick={() => onOpenDetail(post.id)}>
          {post.title}
        </h3>
        <UserChip username={post.uploader} users={users} onOpen={onOpenProfile} className="mt-1" />
        <span className="mono-label text-dim"> · {timeAgo(post.createdAt)}</span>

        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 4).map((t) => (
              <span key={t} className="tag-chip">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
          <button onClick={() => onLike(post)} className={`icon-btn flex items-center gap-1 text-xs ${liked ? "text-red" : ""}`} aria-label="Like edit">
            <Heart size={14} fill={liked ? "currentColor" : "none"} /> {pad5(post.likes)}
          </button>
          <button onClick={() => onOpenDetail(post.id)} className="icon-btn flex items-center gap-1 text-xs" aria-label="View comments">
            <MessageCircle size={14} /> {pad5(commentCount)}
          </button>
          <button onClick={() => onFavorite(post.id)} className={`icon-btn ${favorited ? "text-red" : ""}`} aria-label="Save to favorites">
            <Bookmark size={14} fill={favorited ? "currentColor" : "none"} />
          </button>
          <button onClick={() => onDownload(post)} className="icon-btn flex items-center gap-1 text-xs" aria-label="Download edit">
            <Download size={14} /> {pad5(post.downloads)}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostDetailModal({ post, session, users, onClose, onDownload, onLike, onAddComment, onReport, onBlock, onOpenProfile }) {
  const [draft, setDraft] = useState("");
  const [videoSrc, setVideoSrc] = useState(null);

  useEffect(() => {
    setVideoSrc(null);
    if (post && post.hasVideo) {
      window.storage
        .get(`edit-video:${post.id}`, true)
        .then((r) => setVideoSrc(r ? r.value : null))
        .catch(() => setVideoSrc(null));
    }
  }, [post && post.id, post && post.hasVideo]);

  if (!post) return null;

  const liked = session && post.likedBy.includes(session.username);
  const comments = post.comments || [];

  function submit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddComment(post.id, draft);
    setDraft("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {post.hasVideo ? (
          <div className="thumb relative overflow-hidden rounded-md aspect-video mb-4 bg-black">
            {videoSrc ? (
              <video controls className="absolute inset-0 w-full h-full" src={videoSrc} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="play-orb">
                  <Play size={24} className="text-white" fill="white" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`thumb relative overflow-hidden rounded-md aspect-video mb-4 ${post.thumbnailUrl ? "" : gradientFor(post.id)}`}>
            {post.thumbnailUrl && (
              <img
                src={post.thumbnailUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="play-orb">
                <Play size={24} className="text-white" fill="white" />
              </div>
            </div>
          </div>
        )}

        <h2 className="font-logo text-2xl text-fog tracking-tight">{post.title}</h2>
        <div className="mt-1 flex items-center gap-1">
          <UserChip username={post.uploader} users={users} onOpen={onOpenProfile} />
          <span className="mono-label text-dim">· {timeAgo(post.createdAt)}</span>
        </div>
        {post.description && <p className="text-fog text-sm mt-3 leading-relaxed">{post.description}</p>}
        {(post.animeSource || post.musicCredit) && (
          <div className="mt-3 space-y-0.5">
            {post.animeSource && <p className="mono-label text-dim">Source anime: {post.animeSource}</p>}
            {post.musicCredit && <p className="mono-label text-dim">Music: {post.musicCredit}</p>}
          </div>
        )}
        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="tag-chip">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-5 mt-4 border-t border-white/10 pt-3">
          <button onClick={() => onLike(post)} className={`icon-btn flex items-center gap-1.5 text-xs ${liked ? "text-red" : ""}`}>
            <Heart size={15} fill={liked ? "currentColor" : "none"} /> {pad5(post.likes)}
          </button>
          <button onClick={() => onDownload(post)} className="icon-btn flex items-center gap-1.5 text-xs">
            <Download size={15} /> {pad5(post.downloads)}
          </button>
          <span className="mono-label text-dim">{pad5(post.views || 0)} views</span>
        </div>

        <div className="mt-5">
          <h3 className="mono-label text-dim mb-3">COMMENTS — {comments.length}</h3>
          <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
            {comments.length === 0 && <p className="text-dim text-sm">No comments yet. Say something.</p>}
            {comments
              .slice()
              .reverse()
              .map((c) => (
                <div key={c.id} className="comment-row">
                  <p className="mono-label text-dim">
                    @{c.author} · {timeAgo(c.createdAt)}
                  </p>
                  <p className="text-fog text-sm mt-0.5">{c.text}</p>
                </div>
              ))}
          </div>
          {session ? (
            <form onSubmit={submit} className="flex gap-2 mt-4">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" className="field-input flex-1" />
              <button type="submit" className="btn-primary-sm">
                Post
              </button>
            </form>
          ) : (
            <p className="text-dim text-sm mt-4">Log in to leave a comment.</p>
          )}
        </div>

        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/10">
          <button onClick={() => onReport("post", post.id)} className="mono-label text-dim hover:text-red flex items-center gap-1.5">
            <Flag size={12} /> Report
          </button>
          {session && session.username !== post.uploader && (
            <button onClick={() => onBlock(post.uploader)} className="mono-label text-dim hover:text-red flex items-center gap-1.5">
              <UserX size={12} /> Block @{post.uploader}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* wallpaper card                                                         */
/* ---------------------------------------------------------------------- */

function WallpaperAlbumCard({ album, wallpapers, onOpen, onDelete, isAdmin }) {
  const albumWallpapers = wallpapers.filter((w) => (w.albumId === album.id) || (album.category && w.category === album.category)).slice(0, 4);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadPreviews() {
      const urls = await Promise.all(
        albumWallpapers.slice(0, 4).map(async (w) => {
          if (w.externalUrl) return w.externalUrl;
          if (w.hasImage) {
            try {
              const r = await supabaseStorage.get(`wallpaper-img:${w.id}`, true);
              return r ? r.value : null;
            } catch { return null; }
          }
          return null;
        })
      );
      if (active) setPreviews(urls.filter(Boolean));
    }
    loadPreviews();
    return () => { active = false; };
  }, [album.id, albumWallpapers.length]);

  return (
    <button className="album-card group" onClick={() => onOpen(album)}>
      <div className="album-grid">
        {[0,1,2,3].map((i) => (
          <div key={i} className={`album-cell ${previews[i] ? "" : gradientFor(album.id + i)}`}>
            {previews[i] && <img src={previews[i]} alt="" className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
      <div className="px-1 pt-2 pb-1">
        <p className="font-logo text-fog text-sm tracking-tight truncate">{album.name}</p>
        <p className="mono-label text-dim mt-0.5">{albumWallpapers.length} wallpapers</p>
      </div>
      {isAdmin && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(album); }} className="card-icon-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:text-red">
          <Trash2 size={13} />
        </button>
      )}
    </button>
  );
}

function CreateAlbumModal({ open, onClose, onSubmit, categories }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("All");
  const [err, setErr] = useState("");
  if (!open) return null;
  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setErr("Give the album a name.");
    onSubmit({ name: name.trim(), category });
    setName(""); setCategory("All"); setErr("");
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <Eyebrow>ADMIN — NEW ALBUM</Eyebrow>
        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1 mt-2">Create album</h2>
        <p className="text-dim text-sm mb-4">Albums group wallpapers by anime or theme. Pick a category to auto-fill it.</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Album name e.g. Demon Slayer" className="field-input" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
            <option value="All">All wallpapers (manual)</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {err && <p className="text-sm text-red">{err}</p>}
          <button type="submit" className="btn-primary w-full">Create album</button>
        </form>
      </div>
    </div>
  );
}

function RequestModal({ open, onClose, session, onSubmit }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await onSubmit(text.trim());
    setText(""); setBusy(false); onClose();
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <Eyebrow>COMMUNITY REQUEST</Eyebrow>
        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1 mt-2">Request anything</h2>
        <p className="text-dim text-sm mb-5">Ask the admin for specific wallpapers, anime episodes, edits, or features. Every request is saved and reviewed.</p>
        <form onSubmit={submit} className="space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="e.g. Can you add Bleach Season 2 episodes? Or a wallpaper of Itadori vs Sukuna?" className="field-input resize-none" />
          {!session && <p className="text-red text-sm">Log in to send a request.</p>}
          <button type="submit" disabled={busy || !session} className="btn-primary w-full">{busy ? "Sending…" : "Send request"}</button>
        </form>
      </div>
    </div>
  );
}

function WallpaperCard({ wallpaper, session, isAdmin, showMature, onDownload, onLike, onFavorite, onDelete, onToggleFeatured, favorited, featured }) {
  const [src, setSrc] = useState(wallpaper.externalUrl || null);
  const [revealed, setRevealed] = useState(false);
  const blurred = wallpaper.mature && !showMature && !revealed;

  useEffect(() => {
    let active = true;
    if (!wallpaper.externalUrl && wallpaper.hasImage) {
      window.storage
        .get(`wallpaper-img:${wallpaper.id}`, true)
        .then((r) => {
          if (active && r) setSrc(r.value);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [wallpaper.id, wallpaper.externalUrl, wallpaper.hasImage]);

  const liked = session && wallpaper.likedBy.includes(session.username);

  return (
    <div className="cut-card group" onMouseMove={handleTiltMove} onMouseLeave={handleTiltLeave}>
      <div
        className="thumb relative overflow-hidden rounded-md aspect-[3/4] cursor-pointer"
        style={!src ? undefined : undefined}
        onClick={() => blurred && setRevealed(true)}
      >
        <div className={`absolute inset-0 ${src ? "" : gradientFor(wallpaper.id)} ${blurred ? "mature-blur" : ""}`}>
          {src && <img src={src} alt="" className="w-full h-full object-cover" />}
          {!src && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Film size={22} className="text-white/70" />
            </div>
          )}
        </div>
        {blurred && <span className="mature-label">Mature — tap to reveal</span>}
        <span className="wallpaper-tag">{wallpaper.category}</span>
        {wallpaper.kind && <span className="kind-tag">{wallpaper.kind}</span>}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFeatured(wallpaper);
              }}
              className={`card-icon-btn ${featured ? "text-amber-400" : ""}`}
              title="Toggle featured"
            >
              <Star size={13} fill={featured ? "currentColor" : "none"} />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(wallpaper);
              }}
              className="card-icon-btn opacity-0 group-hover:opacity-100 hover:text-red"
              aria-label="Delete wallpaper"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="px-1 pt-3">
        <h3 className="font-logo text-fog text-sm leading-tight truncate tracking-tight">{wallpaper.title}</h3>
        <p className="mono-label text-dim mt-1">
          by @{wallpaper.uploader} · {timeAgo(wallpaper.createdAt)}
        </p>
        <div className="mt-3 flex items-center gap-4 border-t border-white/10 pt-2.5">
          <button onClick={() => onLike(wallpaper)} className={`icon-btn flex items-center gap-1 text-xs ${liked ? "text-red" : ""}`} aria-label="Like wallpaper">
            <Heart size={14} fill={liked ? "currentColor" : "none"} /> {pad5(wallpaper.likes)}
          </button>
          <button onClick={() => onFavorite(wallpaper.id)} className={`icon-btn ${favorited ? "text-red" : ""}`} aria-label="Save to favorites">
            <Bookmark size={14} fill={favorited ? "currentColor" : "none"} />
          </button>
          <button onClick={() => onDownload(wallpaper)} className="icon-btn flex items-center gap-1 text-xs" aria-label="Download wallpaper">
            <Download size={14} /> {pad5(wallpaper.downloads)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* profile modal                                                          */
/* ---------------------------------------------------------------------- */

function ProfileModal({ username, users, posts, session, isAdmin, postsCount, onClose, onFollow, onSaveBio, onToggleVerified, onAvatarFile, onSetFeaturedCreator, onOpenDetail }) {
  const [editing, setEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  if (!username) return null;

  const profile = users[username] || {};
  const isMe = session && session.username === username;
  const followers = profile.followers || [];
  const following = profile.following || [];
  const iFollow = session && (users[session.username]?.following || []).includes(username);

  const userPosts = posts.filter((p) => p.uploader === username);
  const totalViews = userPosts.reduce((s, p) => s + (p.views || 0), 0);
  const totalDownloads = userPosts.reduce((s, p) => s + p.downloads, 0);
  const totalLikes = userPosts.reduce((s, p) => s + p.likes, 0);
  const score = totalDownloads + totalLikes;

  const badges = [];
  [
    [totalViews, [100, 1000, 10000], "views"],
    [totalDownloads, [50, 500, 5000], "downloads"],
    [totalLikes, [50, 500, 5000], "likes"],
  ].forEach(([value, milestones, label]) => {
    let best = null;
    milestones.forEach((m) => {
      if (value >= m) best = m;
    });
    if (best) badges.push(`${best >= 1000 ? best / 1000 + "K" : best}+ ${label}`);
  });

  const sortedUserPosts = [...userPosts]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt)
    .slice(0, 6);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar username={username} users={users} size={56} />
            {isMe && (
              <label className="avatar-edit-btn" title="Change profile picture">
                <Camera size={12} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden-file-input"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) onAvatarFile(username, f);
                  }}
                />
              </label>
            )}
          </div>
          <div>
            <p className="font-logo text-xl text-fog tracking-tight flex items-center gap-1.5 flex-wrap">
              @{username} {profile.verified && <VerifiedMark />} <CreatorLevel score={score} />
            </p>
            <p className="mono-label text-dim mt-0.5">
              {postsCount} posted · {followers.length} followers · {following.length} following
            </p>
          </div>
        </div>

        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {badges.map((b) => (
              <span key={b} className="badge-pill">
                <Award size={11} /> {b}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                rows={3}
                placeholder="Tell people what you edit…"
                className="field-input resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onSaveBio(bioDraft);
                    setEditing(false);
                  }}
                  className="btn-primary-sm"
                >
                  Save bio
                </button>
                <button onClick={() => setEditing(false)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-fog text-sm leading-relaxed">{profile.bio || (isMe ? "No bio yet." : "This editor hasn't written a bio.")}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-5 flex-wrap">
          {isMe && !editing && (
            <button
              onClick={() => {
                setBioDraft(profile.bio || "");
                setEditing(true);
              }}
              className="btn-ghost"
            >
              Edit bio
            </button>
          )}
          {!isMe && session && (
            <button onClick={() => onFollow(username)} className={iFollow ? "btn-ghost" : "btn-primary-sm"}>
              {iFollow ? "Following" : "Follow"}
            </button>
          )}
          {!isMe && isAdmin && (
            <button onClick={() => onToggleVerified(username)} className="btn-ghost">
              {profile.verified ? "Remove verified" : "Grant verified"}
            </button>
          )}
          {!isMe && isAdmin && (
            <button onClick={() => onSetFeaturedCreator(username)} className="btn-ghost">
              Feature this week
            </button>
          )}
        </div>

        {sortedUserPosts.length > 0 && (
          <div className="mt-6">
            <p className="mono-label text-dim mb-2">EDITS</p>
            <div className="grid grid-cols-3 gap-2">
              {sortedUserPosts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onOpenDetail(p.id);
                    onClose();
                  }}
                  className={`thumb relative overflow-hidden rounded-md aspect-video ${p.thumbnailUrl ? "" : gradientFor(p.id)}`}
                >
                  {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  {p.pinned && <Pin size={11} className="absolute top-1 right-1 text-white" fill="white" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* empty state                                                            */
/* ---------------------------------------------------------------------- */

function EmptyState({ title, body, ctaLabel, onCta }) {
  return (
    <div className="empty-state">
      <p className="text-dim text-sm">
        {title ? (
          <span className="text-fog font-logo text-base block mb-1">{title}</span>
        ) : null}
        {body}
      </p>
      {ctaLabel && (
        <button onClick={onCta} className="btn-primary mt-5">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function CarouselRow({ title, items, renderItem, onSeeAll, itemWidth = 150 }) {
  if (!items.length) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-logo text-base text-fog tracking-tight">{title}</h3>
        {onSeeAll && (
          <button onClick={onSeeAll} className="mono-label text-dim hover:text-red">
            See all
          </button>
        )}
      </div>
      <div className="carousel-row">
        {items.map((item) => (
          <div className="carousel-item" style={{ width: itemWidth }} key={item.id}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* auth modal                                                             */
/* ---------------------------------------------------------------------- */

function AuthModal({ open, mode, setMode, onClose, onLogin, onRegister, error, clearError }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!open) return null;

  function submit(e) {
    e.preventDefault();
    if (mode === "login") onLogin(username, password);
    else onRegister(username, email, password);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="flex gap-1 mb-6 rounded-sm bg-white/5 p-1">
          {["login", "register"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                clearError();
              }}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-mono rounded-sm transition-colors ${
                mode === m ? "bg-white/10 text-fog" : "text-dim"
              }`}
            >
              {m === "login" ? "Sign in" : "Join vault"}
            </button>
          ))}
        </div>

        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1">{mode === "login" ? "Welcome back" : "Join the vault"}</h2>
        <p className="text-dim text-sm mb-5">
          {mode === "login" ? "Sign in to post, like, comment, and manage your uploads." : "Pick a handle and an email. You'll use the handle to post and sign your uploads."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="field-input" />
          {mode === "register" && (
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="field-input" />
          )}
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="field-input" />
          {error && <p className="text-sm text-red">{error}</p>}
          <button type="submit" className="btn-primary w-full mt-1">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mono-label text-dim mt-5 text-center">
          {mode === "register"
            ? "Demo accounts stored on this page only — no real email gets sent, but you'll see a welcome message right here."
            : "Demo accounts stored on this page only — please don't reuse a real password."}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* upload edit modal                                                      */
/* ---------------------------------------------------------------------- */

function UploadModal({ open, onClose, onSubmit, myPosts }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(EDIT_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [mode, setMode] = useState(CLOUDINARY_ENABLED ? "cloudinary" : "file");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState(null);
  const [fileNote, setFileNote] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbMode, setThumbMode] = useState("url"); // "url" | "post"
  const [animeSource, setAnimeSource] = useState("");
  const [musicCredit, setMusicCredit] = useState("");
  const [mature, setMature] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function onFilePicked(e) {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(f);
    setErr("");
    if (!f) { setFileNote(""); return; }
    const mb = (f.size / (1024 * 1024)).toFixed(1);
    if (mode === "file" && f.size > MAX_VIDEO_BYTES) {
      setFileNote(`"${f.name}" is ${mb}MB — too big for direct browser storage. Use Cloudinary or a link.`);
    } else {
      setFileNote(`"${f.name}" — ${mb}MB. ✓`);
    }
  }

  function addQuickTag(t) {
    const list = tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.includes(t)) return;
    setTags(list.length ? [...list, t].join(", ") : t);
  }

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return setErr("Give your edit a title.");
    if (mode === "url" && !videoUrl.trim()) return setErr("Paste a link to where the clip is hosted.");
    if ((mode === "file" || mode === "cloudinary") && !file) return setErr("Select a video file.");
    if (mode === "file" && file && file.size > MAX_VIDEO_BYTES) {
      return setErr("File too big for browser storage — switch to Cloudinary upload or paste a link.");
    }
    setErr("");
    setBusy(true);
    try {
      let finalUrl = mode === "url" ? videoUrl : "";
      if (mode === "cloudinary" && file) {
        setUploadProgress(0);
        finalUrl = await uploadToCloudinary(file, setUploadProgress);
        setUploadProgress(null);
      }
      await onSubmit({
        title, category, description, tags,
        videoUrl: finalUrl,
        file: mode === "file" ? file : null,
        thumbnailUrl, animeSource, musicCredit, mature,
      });
      setTitle(""); setDescription(""); setTags(""); setVideoUrl("");
      setFile(null); setFileNote(""); setThumbnailUrl(""); setAnimeSource(""); setMusicCredit(""); setMature(false);
    } catch (e2) {
      setErr("Upload failed: " + (e2.message || "try again."));
      setUploadProgress(null);
    }
    setBusy(false);
  }

  const MODES = [
    ...(CLOUDINARY_ENABLED ? [{ key: "cloudinary", label: "Upload file (Cloudinary)" }] : []),
    { key: "file", label: "Quick select (small clips)" },
    { key: "url", label: "Paste a link" },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <Eyebrow>NEW UPLOAD</Eyebrow>
        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1 mt-2">Post an edit</h2>
        {CLOUDINARY_ENABLED && <p className="text-dim text-xs mb-4">Cloudinary connected — you can upload full-size MP4s directly.</p>}
        <form onSubmit={submit} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Gojo vs Toji // 60fps AMV" className="field-input" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
            {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Upload mode selector */}
          <div className="flex gap-1 rounded-sm bg-white/5 p-1 flex-wrap">
            {MODES.map((m) => (
              <button key={m.key} type="button" onClick={() => { setMode(m.key); setErr(""); }}
                className={`flex-1 py-2 text-xs uppercase tracking-widest font-mono rounded-sm transition-colors ${mode === m.key ? "bg-white/10 text-fog" : "text-dim"}`}>
                {m.label}
              </button>
            ))}
          </div>

          {(mode === "cloudinary" || mode === "file") && (
            <div>
              <input type="file" accept="video/*" onChange={onFilePicked} className="field-input" />
              {fileNote && <p className={`mono-label mt-1.5 ${file && file.size > MAX_VIDEO_BYTES && mode === "file" ? "text-red" : "text-dim"}`}>{fileNote}</p>}
              {mode === "cloudinary" && !CLOUDINARY_ENABLED && (
                <p className="text-red text-xs mt-1">Cloudinary not configured yet — add your cloud name and preset at the top of the file.</p>
              )}
              {uploadProgress !== null && (
                <div className="mt-2">
                  <div className="render-bar-track"><div className="render-bar-fill" style={{ width: uploadProgress + "%" }} /></div>
                  <p className="mono-label text-dim mt-1">Uploading… {uploadProgress}%</p>
                </div>
              )}
            </div>
          )}
          {mode === "url" && (
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Link to your hosted clip" className="field-input" />
          )}

          <button type="button" onClick={() => setShowHelp((v) => !v)} className="mono-label text-dim hover:text-red text-left">
            {showHelp ? "Hide" : "How do I get a link to my video?"}
          </button>
          {showHelp && (
            <div className="help-box">
              <p className="text-dim text-xs mb-2">Your Photos or Files app can't generate a public link by itself — you need to upload the clip to a service first.</p>
              <p className="text-fog text-xs font-semibold mb-1">On a phone:</p>
              <ol className="text-dim text-xs mb-3 pl-4 list-decimal space-y-0.5">
                <li>Open Google Drive (or YouTube)</li>
                <li>Tap + → Upload → choose the video from your Photos/Camera Roll</li>
                <li>Once uploaded: tap the file → Share → set to "Anyone with the link"</li>
                <li>Tap Copy link, come back here and paste it above</li>
              </ol>
              <p className="text-fog text-xs font-semibold mb-1">On a computer:</p>
              <ol className="text-dim text-xs pl-4 list-decimal space-y-0.5">
                <li>Go to drive.google.com → Upload the video file</li>
                <li>Right-click → Share → set to "Anyone with the link" → Copy link → paste above</li>
              </ol>
              <p className="text-dim text-xs mt-2">Clip under ~3.6MB? Use "Quick select" instead — picks straight from your device.</p>
            </div>
          )}

          {/* Thumbnail picker */}
          <div>
            <p className="mono-label text-dim mb-1.5">Thumbnail</p>
            <div className="flex gap-1 rounded-sm bg-white/5 p-1 mb-2">
              {["url", "post"].map((m) => (
                <button key={m} type="button" onClick={() => setThumbMode(m)}
                  className={`flex-1 py-1.5 text-xs uppercase tracking-widest font-mono rounded-sm transition-colors ${thumbMode === m ? "bg-white/10 text-fog" : "text-dim"}`}>
                  {m === "url" ? "Paste image link" : "From my posts"}
                </button>
              ))}
            </div>
            {thumbMode === "url"
              ? <input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="Image link (optional)" className="field-input" />
              : (
                <div className="grid grid-cols-4 gap-2">
                  {(myPosts || []).filter((p) => p.thumbnailUrl).slice(0, 8).map((p) => (
                    <button key={p.id} type="button" onClick={() => setThumbnailUrl(p.thumbnailUrl)}
                      className={`thumb relative aspect-video overflow-hidden rounded-md border-2 ${thumbnailUrl === p.thumbnailUrl ? "border-red" : "border-transparent"}`}>
                      <img src={p.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    </button>
                  ))}
                  {(myPosts || []).filter((p) => p.thumbnailUrl).length === 0 && (
                    <p className="text-dim text-xs col-span-4">No thumbnails on your existing posts yet.</p>
                  )}
                </div>
              )
            }
          </div>

          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated — action, AMV" className="field-input" />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_EDIT_TAGS.map((t) => <button key={t} type="button" onClick={() => addQuickTag(t)} className="tag-chip">+ {t}</button>)}
          </div>
          <input value={animeSource} onChange={(e) => setAnimeSource(e.target.value)} placeholder="Source anime (optional)" className="field-input" />
          <input value={musicCredit} onChange={(e) => setMusicCredit(e.target.value)} placeholder="Music credit (optional)" className="field-input" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} className="field-input resize-none" />
          <label className="flex items-center gap-2 mono-label text-dim">
            <input type="checkbox" checked={mature} onChange={(e) => setMature(e.target.checked)} />
            Mark as mature content
          </label>
          {err && <p className="text-sm text-red">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full mt-1">
            {busy ? (uploadProgress !== null ? `Uploading ${uploadProgress}%…` : "Processing…") : "Post edit"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* upload wallpaper modal (admin only)                                   */
/* ---------------------------------------------------------------------- */

function WallpaperUploadModal({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(WALLPAPER_CATEGORIES[0]);
  const [kind, setKind] = useState(WALLPAPER_KINDS[0]);
  const [style, setStyle] = useState(WALLPAPER_STYLES[0]);
  const [orientation, setOrientation] = useState(ORIENTATIONS[0]);
  const [mode, setMode] = useState("file");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState(null);
  const [mature, setMature] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return setErr("Give your wallpaper a title.");
    if (mode === "url" && !imageUrl.trim()) return setErr("Paste an image link.");
    if (mode === "file" && !file) return setErr("Choose an image to upload.");
    setErr("");
    setBusy(true);
    try {
      await onSubmit({ title, category, kind, style, orientation, mature, imageUrl: mode === "url" ? imageUrl : "", file: mode === "file" ? file : null });
      setTitle("");
      setImageUrl("");
      setFile(null);
      setMature(false);
    } catch (e2) {
      setErr("Couldn't process that image. Try a smaller file or a link instead.");
    }
    setBusy(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <Eyebrow>ADMIN ONLY</Eyebrow>
        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1 mt-2">Post a wallpaper</h2>
        <p className="text-dim text-sm mb-5">Uploaded images are resized and stored on this page. For very large or animated files, paste a link instead.</p>

        <form onSubmit={submit} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Tanjiro // Hinokami Kagura" className="field-input" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
            {WALLPAPER_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="field-input">
              {WALLPAPER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="field-input">
              {ORIENTATIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="field-input">
            {WALLPAPER_STYLES.map((s) => (
              <option key={s} value={s}>
                {s} style
              </option>
            ))}
          </select>

          <div className="flex gap-1 rounded-sm bg-white/5 p-1">
            {["file", "url"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs uppercase tracking-widest font-mono rounded-sm transition-colors ${mode === m ? "bg-white/10 text-fog" : "text-dim"}`}
              >
                {m === "file" ? "Upload file" : "Paste a link"}
              </button>
            ))}
          </div>

          {mode === "url" ? (
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image link" className="field-input" />
          ) : (
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} className="field-input" />
          )}
          <label className="flex items-center gap-2 mono-label text-dim">
            <input type="checkbox" checked={mature} onChange={(e) => setMature(e.target.checked)} />
            Mark as mature content
          </label>

          {err && <p className="text-sm text-red">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full mt-1">
            {busy ? "Processing…" : "Post wallpaper"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* toast                                                                  */
/* ---------------------------------------------------------------------- */

/* ---- Trending / News components (use free Jikan MyAnimeList API) ---- */

/* ---- Anime API helpers ---- */

// Normalise a Kitsu anime object into a common shape
function fromKitsu(item) {
  const a = item.attributes || {};
  return {
    id: item.id,
    title: a.titles?.en || a.titles?.en_jp || a.canonicalTitle || "Unknown",
    title_english: a.titles?.en || a.canonicalTitle,
    image: a.posterImage?.large || a.posterImage?.medium || a.posterImage?.small || null,
    score: a.averageRating ? (parseFloat(a.averageRating) / 10).toFixed(1) : null,
    episodes: a.episodeCount || null,
    status: a.status || "",
    synopsis: a.synopsis || "",
    type: a.subtype || "TV",
    startDate: a.startDate || "",
    genres: [],
    kitsuId: item.id,
  };
}

// Normalise an Anthropic-generated anime object (same target shape)
function fromAI(raw) {
  return {
    id: raw.id || raw.title,
    title: raw.title_english || raw.title || "Unknown",
    title_english: raw.title_english || raw.title,
    image: null,
    score: raw.score ? String(raw.score) : null,
    episodes: raw.episodes || null,
    status: raw.status || "",
    synopsis: raw.synopsis || "",
    type: raw.type || "TV",
    startDate: raw.startDate || "",
    genres: (raw.genres || []).map((g) => (typeof g === "string" ? g : g.name)),
  };
}

async function fetchKitsu(filter, search) {
  let url;
  if (search) {
    url = `https://kitsu.app/api/edge/anime?filter[text]=${encodeURIComponent(search)}&page[limit]=24`;
  } else if (filter === "now") {
    url = "https://kitsu.app/api/edge/anime?filter[status]=current&sort=-followersCount&page[limit]=24";
  } else if (filter === "upcoming") {
    url = "https://kitsu.app/api/edge/anime?filter[status]=upcoming&sort=startDate&page[limit]=24";
  } else if (filter === "top") {
    url = "https://kitsu.app/api/edge/anime?sort=-averageRating&filter[subtype]=TV&page[limit]=24";
  } else {
    url = "https://kitsu.app/api/edge/anime?sort=-followersCount&filter[subtype]=TV&page[limit]=24";
  }
  const r = await fetch(url, { headers: { Accept: "application/vnd.api+json" } });
  const d = await r.json();
  return (d.data || []).map(fromKitsu);
}

async function fetchFromAI(filter, search) {
  const topic = search
    ? `anime related to "${search}"`
    : filter === "now"
    ? "anime currently airing in 2025"
    : filter === "upcoming"
    ? "upcoming anime releasing in late 2025 or 2026"
    : filter === "top"
    ? "all-time top-rated anime"
    : "most popular anime of all time";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `List 20 ${topic}. Return ONLY a valid JSON array, no markdown fences, no extra text. Each item: {"id":"unique_slug","title":"English title","title_english":"English title","score":8.5,"episodes":24,"status":"Airing","synopsis":"One sentence synopsis.","type":"TV","startDate":"2025-01","genres":["Action","Fantasy"]}`
      }]
    })
  });
  const d = await res.json();
  const text = d.content?.find((c) => c.type === "text")?.text || "[]";
  const clean = text.replace(/```json|```/gi, "").trim();
  return JSON.parse(clean).map(fromAI);
}

/* ---- Trending anime card ---- */
function TrendingAnimeCard({ anime, onSelect }) {
  return (
    <button className="anime-cover-card" onClick={() => onSelect(anime)}>
      <div className="anime-cover-thumb">
        {anime.image
          ? <img src={anime.image} alt={anime.title} className="anime-cover-img" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <div className={`anime-cover-placeholder ${gradientFor(anime.id || anime.title)}`}><Film size={20} className="text-white opacity-50" /></div>
        }
        {anime.score && <span className="anime-score-badge">★ {anime.score}</span>}
        {anime.status === "current" || anime.status === "Airing"
          ? <span className="anime-airing-dot" title="Airing now" />
          : null
        }
      </div>
      <p className="anime-cover-title">{anime.title_english || anime.title}</p>
      <p className="anime-cover-meta">{anime.type || "TV"}{anime.episodes ? ` · ${anime.episodes} ep` : ""}</p>
    </button>
  );
}

/* ---- Anime detail modal ---- */
function AnimeDetailModal({ anime, onClose }) {
  if (!anime) return null;
  const genres = Array.isArray(anime.genres) ? anime.genres.map((g) => typeof g === "string" ? g : g.name) : [];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="flex gap-4 mb-4">
          {anime.image
            ? <img src={anime.image} alt="" className="rounded-md shrink-0" style={{ width: 95, height: 138, objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
            : <div className={`rounded-md shrink-0 flex items-center justify-center ${gradientFor(anime.title)}`} style={{ width: 95, height: 138 }}><Film size={20} className="text-white opacity-60" /></div>
          }
          <div className="min-w-0">
            <h2 className="font-logo text-lg text-fog tracking-tight leading-tight">{anime.title_english || anime.title}</h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {anime.score && <span className="badge-pill">★ {anime.score}</span>}
              {anime.type && <span className="badge-pill">{anime.type}</span>}
              {anime.episodes && <span className="badge-pill">{anime.episodes} eps</span>}
              {anime.status && <span className="badge-pill">{anime.status}</span>}
            </div>
            {genres.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{genres.map((g) => <span key={g} className="tag-chip">{g}</span>)}</div>}
          </div>
        </div>
        {anime.startDate && <p className="mono-label text-dim mb-2">STARTED: <span className="text-fog font-sans normal-case tracking-normal">{anime.startDate}</span></p>}
        {anime.synopsis && <p className="text-dim text-sm leading-relaxed">{anime.synopsis.length > 400 ? anime.synopsis.slice(0, 400) + "…" : anime.synopsis}</p>}
        {anime.kitsuId && (
          <a href={`https://kitsu.io/anime/${anime.kitsuId}`} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-4 inline-flex">View on Kitsu</a>
        )}
      </div>
    </div>
  );
}

/* ---- Trending view ---- */
function TrendingAnimeView() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(""); // "kitsu" | "ai" | "error"
  const [filter, setFilter] = useState("now");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAnime, setSelectedAnime] = useState(null);

  const FILTERS = [
    { key: "now", label: "Airing Now" },
    { key: "upcoming", label: "Upcoming" },
    { key: "top", label: "Top Rated" },
    { key: "popular", label: "Most Popular" },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSource("");

    async function load() {
      try {
        const data = await fetchKitsu(filter, search);
        if (!cancelled) { setList(data); setSource("kitsu"); setLoading(false); }
      } catch (e1) {
        try {
          const data = await fetchFromAI(filter, search);
          if (!cancelled) { setList(data); setSource("ai"); setLoading(false); }
        } catch (e2) {
          if (!cancelled) { setList([]); setSource("error"); setLoading(false); }
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filter, search]);

  return (
    <>
      <div className="flex items-center gap-2 search-bar mb-5">
        <Search size={15} className="text-dim shrink-0" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput.trim()); }}
          placeholder="SEARCH ANY ANIME…"
          className="bg-transparent outline-none text-sm text-fog placeholder:text-dim flex-1 uppercase-placeholder"
        />
        {searchInput && <button onClick={() => { setSearchInput(""); setSearch(""); }} className="text-dim"><X size={14} /></button>}
      </div>

      {!search && (
        <div className="flex flex-wrap gap-2 mb-7">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setFilter(f.key); }} className={`tag-filter ${filter === f.key ? "tag-filter-active" : ""}`}>{f.label}</button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <p className="mono-label text-dim mb-1">Loading anime data…</p>
          <p className="text-dim text-xs">Fetching from Kitsu</p>
        </div>
      )}

      {!loading && source === "error" && (
        <div className="coming-soon-card">
          <p className="text-fog font-logo text-base mb-1">Couldn't load data</p>
          <p className="text-dim text-sm">Try again in a moment.</p>
          <button onClick={() => setFilter(f => f)} className="btn-primary mt-4">Retry</button>
        </div>
      )}

      {!loading && source !== "error" && (
        <>
          {source === "ai" && <p className="mono-label text-dim mb-4">Showing AI-generated data (live API unavailable)</p>}
          {list.length === 0
            ? <div className="coming-soon-card"><p className="text-dim text-sm">No results. Try a different search.</p></div>
            : (
              <div className="anime-cover-grid">
                {list.map((a, i) => <TrendingAnimeCard key={a.id || i} anime={a} onSelect={setSelectedAnime} />)}
              </div>
            )
          }
        </>
      )}

      <AnimeDetailModal anime={selectedAnime} onClose={() => setSelectedAnime(null)} />
    </>
  );
}

/* ---- Anime news view (Kitsu seasonal + Anthropic web search) ---- */
function AnimeNewsView() {
  const [items, setItems] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [loadingAnime, setLoadingAnime] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [tab, setTab] = useState("airing");

  // Fetch seasonal anime (airing / upcoming) from Kitsu with AI fallback
  useEffect(() => {
    let cancelled = false;
    setLoadingAnime(true);
    const f = tab === "airing" ? "now" : "upcoming";

    async function load() {
      try {
        const data = await fetchKitsu(f, "");
        if (!cancelled) { setItems(data); setLoadingAnime(false); }
      } catch (e) {
        try {
          const data = await fetchFromAI(f, "");
          if (!cancelled) { setItems(data); setLoadingAnime(false); }
        } catch (e2) {
          if (!cancelled) { setItems([]); setLoadingAnime(false); }
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tab]);

  // Fetch live anime news via Anthropic web search (runs once on mount)
  useEffect(() => {
    let cancelled = false;
    async function loadNews() {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1200,
            messages: [{
              role: "user",
              content: `Give me 10 recent anime news items covering: new seasons confirmed, manga adaptations announced, recently aired shows, upcoming releases in 2025, and studio announcements. Return ONLY a valid JSON array with no markdown, no extra text: [{"title":"...","summary":"1-2 sentences","category":"New Season","date":"2025"}]. Start the response with [ and end with ]`
            }]
          })
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error.message);
        const blocks = (d.content || []).filter((c) => c.type === "text").map((c) => c.text);
        const raw = blocks.join("");
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        if (start !== -1 && end !== -1) {
          const parsed = JSON.parse(raw.slice(start, end + 1));
          if (!cancelled) setNewsItems(parsed);
        }
      } catch (e) {
        // silently fail — seasonal grid below still works
      }
      if (!cancelled) setLoadingNews(false);
    }
    loadNews();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {/* Live news headlines */}
      <div className="mb-8">
        <Eyebrow>LIVE HEADLINES</Eyebrow>
        <h3 className="font-logo text-xl text-fog tracking-tight mt-2 mb-4">Latest anime news</h3>
        {loadingNews && <p className="mono-label text-dim py-4">Searching for latest news…</p>}
        {!loadingNews && newsItems.length === 0 && <p className="text-dim text-sm">No news found right now.</p>}
        {!loadingNews && newsItems.length > 0 && (
          <div className="space-y-2">
            {newsItems.map((n, i) => (
              <div key={i} className="anime-news-item">
                <span className="news-cat-badge">{n.category}</span>
                <p className="text-fog text-sm font-semibold">{n.title}</p>
                <p className="text-dim text-xs mt-0.5 leading-relaxed">{n.summary}</p>
                <p className="mono-label text-dim mt-1">{n.date}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seasonal grid */}
      <div className="flex gap-2 mb-5 border-t border-white/10 pt-6">
        {[["airing", "Airing This Season"], ["upcoming", "Coming Next Season"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`tag-filter ${tab === k ? "tag-filter-active" : ""}`}>{l}</button>
        ))}
      </div>
      {loadingAnime && <p className="mono-label text-dim py-6">Loading seasonal anime…</p>}
      {!loadingAnime && (
        <div className="anime-cover-grid">
          {items.map((a, i) => (
            <div key={a.id || i} className="anime-cover-card">
              <div className="anime-cover-thumb">
                {a.image
                  ? <img src={a.image} alt={a.title} className="anime-cover-img" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  : <div className={`anime-cover-placeholder ${gradientFor(a.title)}`} />
                }
                {a.score && <span className="anime-score-badge">★ {a.score}</span>}
              </div>
              <p className="anime-cover-title">{a.title_english || a.title}</p>
              <p className="anime-cover-meta">{a.episodes ? `${a.episodes} eps` : "Ongoing"}{a.score ? ` · ★ ${a.score}` : ""}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EpisodeCard({ ep, isAdmin, onView, onDelete }) {
  const dubClass = ep.dubType === "Dub" ? "dub-dub" : ep.dubType === "Both" ? "dub-both" : "dub-sub";
  return (
    <div className="cut-card group" onMouseMove={handleTiltMove} onMouseLeave={handleTiltLeave}>
      <div
        className={`thumb relative overflow-hidden rounded-md aspect-video cursor-pointer ${ep.thumbnailUrl ? "" : gradientFor(ep.id)}`}
        onClick={() => onView(ep)}
      >
        {ep.thumbnailUrl && <img src={ep.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="play-orb">
            <Play size={20} className="text-white" fill="white" />
          </div>
        </div>
        <span className="episode-num-tag">S{ep.season}E{ep.epNumber}</span>
        <span className={`dub-badge ${dubClass}`}>{ep.dubType || "Sub"}</span>
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(ep); }}
            className="card-icon-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:text-red"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="px-1 pt-3">
        <p className="mono-label text-red mb-0.5">{ep.show}</p>
        <h3 className="font-logo text-fog text-sm leading-tight tracking-tight truncate">{ep.title}</h3>
        <p className="mono-label text-dim mt-1">S{ep.season}E{ep.epNumber} · {ep.dubType || "Sub"} · {pad5(ep.views || 0)} views</p>
      </div>
    </div>
  );
}

function AnimeEpisodeUploadModal({ open, onClose, onSubmit }) {
  const [show, setShow] = useState(ANIME_SHOWS[0]);
  const [season, setSeason] = useState("1");
  const [epNumber, setEpNumber] = useState("1");
  const [dubType, setDubType] = useState("Sub");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) return setErr("Give the episode a title.");
    if (!videoUrl.trim()) return setErr("Paste a link to the hosted episode.");
    setErr("");
    onSubmit({ show, season, epNumber, dubType, title, description, videoUrl, thumbnailUrl });
    setTitle(""); setDescription(""); setVideoUrl(""); setThumbnailUrl("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <Eyebrow>ADMIN ONLY — ANIME EPISODE</Eyebrow>
        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1 mt-2">Add an episode</h2>
        <p className="text-dim text-sm mb-5">
          Episodes are link-based — paste a link to wherever the episode is hosted.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <select value={show} onChange={(e) => setShow(e.target.value)} className="field-input">
            {ANIME_SHOWS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Season" className="field-input" type="number" min="1" />
            <input value={epNumber} onChange={(e) => setEpNumber(e.target.value)} placeholder="Ep #" className="field-input" type="number" min="1" />
            <select value={dubType} onChange={(e) => setDubType(e.target.value)} className="field-input">
              <option value="Sub">Sub</option>
              <option value="Dub">Dub</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title" className="field-input" />
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Link to hosted episode" className="field-input" />
          <input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="Thumbnail image link (optional)" className="field-input" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Episode description (optional)" rows={2} className="field-input resize-none" />
          <button type="button" onClick={() => setShowHelp((v) => !v)} className="mono-label text-dim hover:text-red text-left">
            {showHelp ? "Hide" : "How do I get a link to the episode?"}
          </button>
          {showHelp && (
            <div className="help-box">
              <p className="text-dim text-xs mb-2">You need to host the video file somewhere first, then paste its public link here.</p>
              <p className="text-fog text-xs font-semibold mb-1">Options:</p>
              <ol className="text-dim text-xs pl-4 list-decimal space-y-0.5">
                <li>Google Drive → Upload file → Share → Anyone with link → Copy link</li>
                <li>YouTube → Upload → set to Unlisted → Copy link</li>
                <li>Streamable.com → Upload → Copy link once processed</li>
              </ol>
            </div>
          )}
          {err && <p className="text-sm text-red">{err}</p>}
          <button type="submit" className="btn-primary w-full">Add episode</button>
        </form>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

function notifText(n) {
  if (n.type === "like") return `@${n.fromUser} liked "${n.postTitle}"`;
  if (n.type === "comment") return `@${n.fromUser} commented on "${n.postTitle}"`;
  if (n.type === "follow") return `@${n.fromUser} started following you`;
  return "New activity";
}

function NotificationsPanel({ open, notifications, onClose, onOpenProfile, onOpenPost }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <Eyebrow>ACTIVITY</Eyebrow>
        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1 mt-2">Notifications</h2>
        <div className="mt-4 -mx-2">
          {notifications.length === 0 && <p className="text-dim text-sm px-2">Nothing yet — likes, comments, and new followers show up here.</p>}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (n.type === "follow") onOpenProfile(n.fromUser);
                else if (n.postId) onOpenPost(n.postId);
              }}
              className={`notif-row w-full text-left ${!n.read ? "notif-unread" : ""}`}
            >
              <p className="text-fog">{notifText(n)}</p>
              <p className="mono-label text-dim mt-0.5">{timeAgo(n.createdAt)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ open, onClose, notifSettings, onSaveNotifSettings, theme, onCycleTheme, showMature, onSaveShowMature }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <Eyebrow>PREFERENCES</Eyebrow>
        <h2 className="font-logo text-2xl text-fog tracking-tight mb-1 mt-2">Settings</h2>

        <p className="mono-label text-dim mt-5 mb-2">APPEARANCE</p>
        <button onClick={onCycleTheme} className="btn-ghost">
          Theme: {theme === "dark" ? "Dark" : theme === "amoled" ? "AMOLED" : "Light"} — tap to change
        </button>

        <p className="mono-label text-dim mt-6 mb-2">NOTIFY ME ABOUT</p>
        <div className="space-y-2">
          {[
            ["likes", "Likes on my edits"],
            ["comments", "Comments on my edits"],
            ["follows", "New followers"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-fog">
              <input
                type="checkbox"
                checked={notifSettings[key]}
                onChange={(e) => onSaveNotifSettings({ ...notifSettings, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        <p className="mono-label text-dim mt-6 mb-2">CONTENT</p>
        <label className="flex items-center gap-2 text-sm text-fog">
          <input type="checkbox" checked={showMature} onChange={(e) => onSaveShowMature(e.target.checked)} />
          Show mature content
        </label>
      </div>
    </div>
  );
}

function ChatPanel({ open, onClose, messages, session, draft, setDraft, onSend }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 100);
    }
  }, [open, messages.length]);

  function submit(e) {
    e.preventDefault();
    onSend();
  }

  return (
    <>
      {/* backdrop - only dims slightly, doesn't close on click so chat stays open while browsing */}
      {open && <div className="chat-backdrop" onClick={onClose} />}

      <div className={`chat-drawer ${open ? "chat-drawer-open" : ""}`}>
        <div className="chat-drawer-inner">
          {/* header */}
          <div className="chat-header">
            <div>
              <p className="font-logo text-fog text-base tracking-tight">Community Chat</p>
              <p className="mono-label text-dim flex items-center gap-1.5">
                <span className={REALTIME_CHAT_ENABLED ? "live-dot-green" : "live-dot-amber"} />
                {REALTIME_CHAT_ENABLED ? "Live — instant" : "Refreshes every 4s"}
              </p>
            </div>
            <button onClick={onClose} className="modal-close" style={{ position: "static" }} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* messages */}
          <div className="chat-messages-area">
            {messages.length === 0 && (
              <p className="text-dim text-sm text-center mt-10">No messages yet — be the first to say something.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${session && m.author === session.username ? "chat-bubble-mine" : ""}`}>
                <p className="mono-label text-dim">@{m.author} · {timeAgo(m.createdAt)}</p>
                <p className="text-fog text-sm mt-0.5">{m.text}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* input */}
          <div className="chat-input-row">
            {session ? (
              <form onSubmit={submit} className="flex gap-2 w-full">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Say something…"
                  className="field-input flex-1"
                  style={{ borderRadius: 999 }}
                />
                <button type="submit" className="btn-primary-sm" style={{ borderRadius: 999, padding: "8px 14px" }}>
                  <Send size={15} />
                </button>
              </form>
            ) : (
              <p className="text-dim text-sm text-center w-full">Log in to join the conversation.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* main app                                                               */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Draggable chat FAB                                                      */
/* ---------------------------------------------------------------------- */

function DraggableChatFab({ chatOpen, hasMessages, onToggle }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 22, y: null }); // null y = use CSS bottom:28px default
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  function onPointerDown(e) {
    if (e.button && e.button !== 0) return;
    dragging.current = true;
    moved.current = false;
    const rect = ref.current.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    ref.current.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging.current) return;
    moved.current = true;
    const nx = Math.max(0, Math.min(window.innerWidth - 56, e.clientX - offset.current.x));
    const ny = Math.max(0, Math.min(window.innerHeight - 56, e.clientY - offset.current.y));
    setPos({ x: nx, y: ny });
  }

  function onPointerUp() {
    dragging.current = false;
  }

  function onClick() {
    if (!moved.current) onToggle();
    moved.current = false;
  }

  const style = {
    left: pos.x,
    top: pos.y !== null ? pos.y : undefined,
    bottom: pos.y === null ? 28 : undefined,
    right: undefined,
    cursor: dragging.current ? "grabbing" : "grab",
    userSelect: "none",
    touchAction: "none",
  };

  return (
    <button
      ref={ref}
      className="chat-fab"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
      aria-label="Open community chat"
      title="Drag to move · Tap to open chat"
    >
      <MessageCircle size={22} fill={chatOpen ? "white" : "none"} />
      {!chatOpen && hasMessages && <span className="chat-fab-dot" />}
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Edit profile modal                                                      */
/* ---------------------------------------------------------------------- */

const BANNER_COLORS = [
  "#E8283F", "#7B2FF7", "#0E7490", "#4D7C0F",
  "#B45309", "#BE185D", "#1D4ED8", "#065F46",
];

function EditProfileModal({ open, onClose, session, users, onSave, onAvatarFile, isAdmin, onMakeAdmin, onRemoveAdmin, adminUsernames }) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [bannerColor, setBannerColor] = useState("#E8283F");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [addAdminInput, setAddAdminInput] = useState("");

  useEffect(() => {
    if (!open || !session) return;
    const u = users[session.username] || {};
    setDisplayName(u.displayName || "");
    setBio(u.bio || "");
    setBannerColor(u.bannerColor || "#E8283F");
    setWebsite(u.website || "");
    // Load current avatar
    if (u.hasAvatar) {
      supabaseStorage.get(`avatar-img:${session.username}`, true)
        .then((r) => r && setAvatarSrc(r.value))
        .catch(() => {});
    }
  }, [open, session && session.username]);

  if (!open || !session) return null;

  async function handleAvatarChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setBusy(true);
    await onAvatarFile(session.username, f);
    // reload preview
    const r = await supabaseStorage.get(`avatar-img:${session.username}`, true).catch(() => null);
    if (r) setAvatarSrc(r.value);
    setBusy(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    await onSave({ displayName, bio, bannerColor, website });
    setBusy(false);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        {/* Banner */}
        <div className="edit-profile-banner" style={{ background: bannerColor }}>
          <div className="scanline-overlay" />
        </div>

        {/* Avatar + name */}
        <div className="flex items-end gap-4 -mt-8 mb-5 px-1">
          <div className="relative">
            <div className="avatar-lg-wrap" style={{ background: avatarSrc ? "transparent" : avatarColorFor(session.username) }}>
              {avatarSrc
                ? <img src={avatarSrc} alt="" className="w-full h-full object-cover rounded-full" />
                : <span style={{ fontSize: 28, color: "#fff", fontFamily: "Archivo Black,sans-serif" }}>{session.username[0].toUpperCase()}</span>
              }
            </div>
            <label className="avatar-edit-btn" title="Change picture">
              <Camera size={12} />
              <input type="file" accept="image/*" className="hidden-file-input" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <p className="font-logo text-xl text-fog tracking-tight">@{session.username}</p>
            <p className="mono-label text-dim">Edit your profile below</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mono-label text-dim block mb-1">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={session.username}
              maxLength={32}
              className="field-input"
            />
            <p className="mono-label text-dim mt-1">Username (@{session.username}) can't be changed.</p>
          </div>

          <div>
            <label className="mono-label text-dim block mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={280}
              placeholder="Tell people what you edit…"
              className="field-input resize-none"
            />
            <p className="mono-label text-dim mt-0.5">{bio.length}/280</p>
          </div>

          <div>
            <label className="mono-label text-dim block mb-1">Website / social link</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://your-link.com"
              className="field-input"
            />
          </div>

          <div>
            <label className="mono-label text-dim block mb-2">Profile banner colour</label>
            <div className="flex flex-wrap gap-2">
              {BANNER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBannerColor(c)}
                  className="banner-swatch"
                  style={{ background: c, outline: bannerColor === c ? `3px solid #fff` : "none" }}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Saving…" : "Save profile"}
          </button>

          {isAdmin && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <p className="mono-label text-red mb-3">⚡ ADMIN — MANAGE ADMINS</p>
              <div className="space-y-2 mb-3">
                {(adminUsernames || []).map((u) => (
                  <div key={u} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "rgba(232,40,63,0.08)", border: "1px solid rgba(232,40,63,0.2)" }}>
                    <span className="mono-label text-fog">@{u}</span>
                    {u !== (session && session.username.toLowerCase()) && (
                      <button type="button" onClick={() => onRemoveAdmin(u)} className="mono-label text-red hover:text-fog">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={addAdminInput}
                  onChange={(e) => setAddAdminInput(e.target.value)}
                  placeholder="Enter username to make admin"
                  className="field-input flex-1"
                />
                <button
                  type="button"
                  onClick={() => { if (addAdminInput.trim()) { onMakeAdmin(addAdminInput.trim()); setAddAdminInput(""); } }}
                  className="btn-primary-sm"
                >
                  Add
                </button>
              </div>
              <p className="mono-label text-dim mt-2">Only admins see this. Up to 5 admins recommended.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Requests tab — general help/requests to admin, not just wallpapers      */
/* ---------------------------------------------------------------------- */

function RequestsTab({ session, showToast }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("General");
  const [busy, setBusy] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const CATEGORIES = ["General", "Wallpaper request", "Anime episode request", "Bug report", "Feature idea"];

  useEffect(() => {
    if (!session) return;
    supabaseStorage.get("user-requests", true).then((r) => {
      if (r) {
        const all = JSON.parse(r.value);
        setMyRequests(all.filter((req) => req.from === session.username).slice(0, 10));
      }
    }).catch(() => {});
  }, [session && session.username]);

  async function submit(e) {
    e.preventDefault();
    if (!session) return;
    if (!text.trim()) return;
    setBusy(true);
    const req = { id: generateId(), text: text.trim(), category, from: session.username, createdAt: Date.now(), status: "pending" };
    try {
      const r = await supabaseStorage.get("user-requests", true);
      const list = r ? JSON.parse(r.value) : [];
      const next = [req, ...list].slice(0, 500);
      await supabaseStorage.set("user-requests", JSON.stringify(next), true);
      setMyRequests(next.filter((x) => x.from === session.username).slice(0, 10));
    } catch (e2) {}
    setText("");
    setBusy(false);
    showToast("Request sent to the admin!");
  }

  return (
    <section className="max-w-2xl mx-auto px-5 pt-44 pb-28">
      <Eyebrow>TALK TO THE ADMIN</Eyebrow>
      <h2 className="font-logo text-3xl md:text-4xl text-fog tracking-tight mt-3 mb-2">
        Requests <span className="text-red">&amp; help</span>
      </h2>
      <p className="text-dim text-sm mb-8">
        Ask for anything — a specific wallpaper, an anime episode, a new feature, or report a bug. Every request goes straight to the admin.
      </p>

      {session ? (
        <form onSubmit={submit} className="space-y-3 mb-10">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="e.g. Can you add Jujutsu Kaisen Season 3? Or: the chat button overlaps my nav bar on mobile."
            className="field-input resize-none"
          />
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Sending…" : "Send request"}</button>
        </form>
      ) : (
        <div className="coming-soon-card mb-10">
          <p className="text-dim text-sm">Log in to send a request to the admin.</p>
        </div>
      )}

      {myRequests.length > 0 && (
        <div>
          <p className="mono-label text-dim mb-3">YOUR RECENT REQUESTS</p>
          <div className="space-y-2">
            {myRequests.map((r) => (
              <div key={r.id} className="notif-row">
                <span className="news-cat-badge">{r.category || "General"}</span>
                <p className="text-fog text-sm mt-1">{r.text}</p>
                <p className="mono-label text-dim mt-1">{timeAgo(r.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Resolution / device preview tab — self-contained, own state             */
/* ---------------------------------------------------------------------- */

function ResolutionPreviewTab() {
  const [device, setDevice] = useState("phone");
  const DEVICES = [
    { key: "phone", label: "iPhone", icon: "📱", w: 393, h: 852, name: "iPhone 15 Pro — 393×852" },
    { key: "tablet", label: "iPad", icon: "⬜", w: 820, h: 1180, name: "iPad Air — 820×1180" },
    { key: "desktop", label: "Laptop", icon: "💻", w: 1280, h: 800, name: "MacBook Pro — 1280×800" },
  ];
  const current = DEVICES.find((d) => d.key === device);
  const [url, setUrl] = useState("");

  useEffect(() => {
    try { setUrl(window.location.href); } catch (e) { setUrl(""); }
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-5 pt-44 pb-28">
      <Eyebrow>DEVICE PREVIEW</Eyebrow>
      <h2 className="font-logo text-3xl md:text-4xl text-fog tracking-tight mt-3 mb-2">
        Resolution <span className="text-red">preview</span>
      </h2>
      <p className="text-dim text-sm mb-8">See how ANIMEVAULT looks on different screen sizes.</p>

      <div className="flex gap-2 mb-8">
        {DEVICES.map((d) => (
          <button key={d.key} onClick={() => setDevice(d.key)} className={`device-pill ${device === d.key ? "device-pill-active" : ""}`}>
            {d.icon} {d.label}
          </button>
        ))}
      </div>

      <div className="device-preview-stage">
        <div className="device-frame-inner" style={{ width: Math.min(current.w, 900), maxWidth: "100%" }}>
          <div className="device-chrome">
            <div className="device-chrome-bar">
              <span className="device-chrome-dot" style={{ background: "#ff5f57" }} />
              <span className="device-chrome-dot" style={{ background: "#febc2e" }} />
              <span className="device-chrome-dot" style={{ background: "#28c840" }} />
              <span className="mono-label text-dim mx-auto">{current.name}</span>
            </div>
          </div>
          <div className="device-screen" style={{ height: Math.min(current.h, 640) }}>
            {url ? (
              <iframe
                src={url}
                title="ANIMEVAULT preview"
                style={{ width: "100%", height: "100%", border: "none", background: "#0A0A0B" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="mono-label text-dim">Preview loads once deployed to a live URL</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mono-label text-dim mt-6 text-center">
        This preview embeds the live app — it only renders content once ANIMEVAULT is deployed to a real URL (e.g. via Vercel or Netlify).
      </p>
    </section>
  );
}

export default function App() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [view, setView] = useState("edits");
  const [theme, setTheme] = useState("dark");
  // deviceFrame state removed — device preview now lives in its own ResolutionPreviewTab component

  const [users, setUsers] = useState({});
  const [dynamicAdmins, setDynamicAdmins] = useState([]); // extra admins added via UI, merged with ADMIN_USERNAMES
  const [posts, setPosts] = useState([]);
  const [wallpapers, setWallpapers] = useState([]);
  const [session, setSession] = useState(null);
  const [favorites, setFavorites] = useState({ posts: [], wallpapers: [] });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showMature, setShowMature] = useState(false);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [wallpaperUploadOpen, setWallpaperUploadOpen] = useState(false);
  const [detailPostId, setDetailPostId] = useState(null);
  const [profileViewUsername, setProfileViewUsername] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const [wallpaperCategory, setWallpaperCategory] = useState("All");
  const [wallpaperKind, setWallpaperKind] = useState("All");
  const [wallpaperStyle, setWallpaperStyle] = useState("All");
  const [wallpaperOrientation, setWallpaperOrientation] = useState("All");

  const [animeSubTab, setAnimeSubTab] = useState("Episodes");
  const [animeEpisodes, setAnimeEpisodes] = useState([]);
  const [animeShowFilter, setAnimeShowFilter] = useState("All");
  const [animeSeasonFilter, setAnimeSeasonFilter] = useState("All");
  const [animeDubFilter, setAnimeDubFilter] = useState("All");
  const [animeUploadOpen, setAnimeUploadOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [wallpaperAlbums, setWallpaperAlbums] = useState([]);
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);

  const [trendingAnime, setTrendingAnime] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState(null);
  const [seasonalAnime, setSeasonalAnime] = useState([]);
  const [trendingSubFilter, setTrendingSubFilter] = useState("top");

  const [animeNews, setAnimeNews] = useState([]);
  const [newsUploadOpen, setNewsUploadOpen] = useState(false);

  const [collections, setCollections] = useState([]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [addToCollectionPostId, setAddToCollectionPostId] = useState(null);

  const [polls, setPolls] = useState([]);
  const [pollsOpen, setPollsOpen] = useState(false);
  const [createPollOpen, setCreatePollOpen] = useState(false);

  const [challenge, setChallenge] = useState(null);
  const [editStyleFilter, setEditStyleFilter] = useState("All");
  const [forYouMode, setForYouMode] = useState(false);

  const [featuredCreator, setFeaturedCreator] = useState(null);
  const [notifSettings, setNotifSettings] = useState({ likes: true, comments: true, follows: true });
  const [myNotifications, setMyNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");

  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState(null);

  const heroBgRef = useRef(null);
  const progressRef = useRef(null);

  /* ---- load persisted data ---- */
  useEffect(() => {
    (async () => {
      try {
        const u = await supabaseStorage.get("users", true);
        setUsers(u ? JSON.parse(u.value) : {});
      } catch (e) {
        setUsers({});
      }
      try {
        const p = await supabaseStorage.get("posts", true);
        setPosts(p ? JSON.parse(p.value) : []);
      } catch (e) {
        setPosts([]);
      }
      try {
        const w = await supabaseStorage.get("wallpapers-index", true);
        setWallpapers(w ? JSON.parse(w.value) : []);
      } catch (e) {
        setWallpapers([]);
      }
      try {
        const ep = await supabaseStorage.get("anime-episodes", true);
        setAnimeEpisodes(ep ? JSON.parse(ep.value) : []);
      } catch (e) {
        setAnimeEpisodes([]);
      }
      try {
        const alb = await supabaseStorage.get("wallpaper-albums", true);
        setWallpaperAlbums(alb ? JSON.parse(alb.value) : []);
      } catch (e) {
        setWallpaperAlbums([]);
      }
      try {
        const s = await supabaseStorage.get("session", false);
        setSession(s ? JSON.parse(s.value) : null);
      } catch (e) {
        setSession(null);
      }
      try {
        const f = await supabaseStorage.get("favorites", false);
        setFavorites(f ? JSON.parse(f.value) : { posts: [], wallpapers: [] });
      } catch (e) {
        setFavorites({ posts: [], wallpapers: [] });
      }
      try {
        const b = await supabaseStorage.get("blocked-users", false);
        setBlockedUsers(b ? JSON.parse(b.value) : []);
      } catch (e) {
        setBlockedUsers([]);
      }
      try {
        const t = await supabaseStorage.get("theme", false);
        const v = t ? t.value : "dark";
        setTheme(v === "light" || v === "amoled" ? v : "dark");
      } catch (e) {
        setTheme("dark");
      }
      try {
        const m = await supabaseStorage.get("show-mature", false);
        setShowMature(m ? m.value === "true" : false);
      } catch (e) {
        setShowMature(false);
      }
      try {
        const fc = await supabaseStorage.get("featured-creator", true);
        setFeaturedCreator(fc ? fc.value : null);
      } catch (e) {
        setFeaturedCreator(null);
      }
      try {
        const ns = await supabaseStorage.get("notif-settings", false);
        setNotifSettings(ns ? JSON.parse(ns.value) : { likes: true, comments: true, follows: true });
      } catch (e) {
        setNotifSettings({ likes: true, comments: true, follows: true });
      }
      try {
        const da = await supabaseStorage.get("dynamic-admins", true);
        setDynamicAdmins(da ? JSON.parse(da.value) : []);
      } catch (e) {
        setDynamicAdmins([]);
      }
      setDataLoaded(true);
    })();
  }, []);

  /* ---- notifications: load mine whenever I'm logged in, and refresh occasionally ---- */
  useEffect(() => {
    if (!session) {
      setMyNotifications([]);
      return;
    }
    let active = true;
    async function load() {
      try {
        const r = await supabaseStorage.get(`notifications:${session.username}`, true);
        if (active) setMyNotifications(r ? JSON.parse(r.value) : []);
      } catch (e) {
        if (active) setMyNotifications([]);
      }
    }
    load();
    const interval = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session && session.username]);

  /* ---- chat: real-time via Socket.io (if backend configured), else Supabase polling ---- */
  const socketRef = useRef(null);

  useEffect(() => {
    if (!REALTIME_CHAT_ENABLED) return; // fall through to polling effect below
    if (!chatOpen) return;

    let cancelled = false;
    (async () => {
      // socket.io-client loads on demand — sandboxes like StackBlitz/CodeSandbox
      // auto-install it from npm the first time this import runs.
      const { io } = await import("socket.io-client");
      if (cancelled) return;
      const socket = io(BACKEND_URL);
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("chat:join");
      });
      socket.on("chat:history", (messages) => setChatMessages(messages));
      socket.on("chat:message", (message) => setChatMessages((prev) => [...prev, message].slice(-200)));
    })();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [chatOpen]);

  /* ---- chat fallback: poll Supabase every 4s (used only when no real-time backend is set) ---- */
  useEffect(() => {
    if (REALTIME_CHAT_ENABLED) return; // real-time effect above handles it instead
    let active = true;
    async function load() {
      try {
        const r = await supabaseStorage.get("chat-messages", true);
        if (active && r && r.value) {
          setChatMessages(JSON.parse(r.value));
        }
        // if r is null (no messages yet), leave existing state alone
      } catch (e) {
        // storage error — do NOT wipe existing messages, just skip this poll
      }
    }
    if (chatOpen) {
      load();
      const interval = setInterval(load, 4000);
      return () => { active = false; clearInterval(interval); };
    }
    return () => { active = false; };
  }, [chatOpen]);

  /* ---- scroll: progress bar, parallax, sticky nav ---- */
  useEffect(() => {
    function onScroll() {
      const scrollY = window.scrollY;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? (scrollY / max) * 100 : 0;
      if (progressRef.current) progressRef.current.style.width = pct + "%";
      if (heroBgRef.current && !prefersReducedMotion()) {
        heroBgRef.current.style.transform = `translateY(${scrollY * 0.22}px)`;
      }
      setScrolled(scrollY > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function switchView(v) {
    setView(v);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  async function saveUsers(next) {
    setUsers(next);
    try {
      await supabaseStorage.set("users", JSON.stringify(next), true);
    } catch (e) {}
  }
  async function savePosts(next) {
    setPosts(next);
    try {
      await supabaseStorage.set("posts", JSON.stringify(next), true);
    } catch (e) {}
  }
  async function saveWallpapersIndex(next) {
    setWallpapers(next);
    try {
      await supabaseStorage.set("wallpapers-index", JSON.stringify(next), true);
    } catch (e) {}
  }
  async function saveSession(next) {
    setSession(next);
    try {
      if (next) await supabaseStorage.set("session", JSON.stringify(next), false);
      else await supabaseStorage.delete("session", false);
    } catch (e) {}
  }
  async function saveFavorites(next) {
    setFavorites(next);
    try {
      await supabaseStorage.set("favorites", JSON.stringify(next), false);
    } catch (e) {}
  }
  async function saveBlockedUsers(next) {
    setBlockedUsers(next);
    try {
      await supabaseStorage.set("blocked-users", JSON.stringify(next), false);
    } catch (e) {}
  }
  async function saveTheme(next) {
    setTheme(next);
    try {
      await supabaseStorage.set("theme", next, false);
    } catch (e) {}
  }
  function cycleTheme() {
    saveTheme(theme === "dark" ? "amoled" : theme === "amoled" ? "light" : "dark");
  }
  async function saveShowMature(next) {
    setShowMature(next);
    try {
      await supabaseStorage.set("show-mature", String(next), false);
    } catch (e) {}
  }
  async function saveNotifSettings(next) {
    setNotifSettings(next);
    try {
      await supabaseStorage.set("notif-settings", JSON.stringify(next), false);
    } catch (e) {}
  }
  async function handleAvatarFile(username, file) {
    try {
      const dataUrl = await resizeImageFile(file, 300, 0.82);
      await supabaseStorage.set(`avatar-img:${username}`, dataUrl, true);
      const u = users[username] || {};
      await saveUsers({ ...users, [username]: { ...u, hasAvatar: true } });
      showToast("Profile picture updated.");
    } catch (e) {
      showToast("Couldn't update your picture — try a smaller image.");
    }
  }
  async function saveWallpaperAlbums(next) {
    setWallpaperAlbums(next);
    try { await supabaseStorage.set("wallpaper-albums", JSON.stringify(next), true); } catch (e) {}
  }

  function handleCreateAlbum({ name, category }) {
    const album = { id: generateId(), name, category, createdAt: Date.now() };
    saveWallpaperAlbums([album, ...wallpaperAlbums]);
    showToast(`Album "${name}" created.`);
  }

  function handleDeleteAlbum(album) {
    if (!isAdmin) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete album "${album.name}"?`)) return;
    saveWallpaperAlbums(wallpaperAlbums.filter((a) => a.id !== album.id));
    showToast("Album deleted.");
  }

  async function handleSendRequest(text) {
    const req = { id: generateId(), text, from: session ? session.username : "anonymous", createdAt: Date.now() };
    try {
      const r = await supabaseStorage.get("user-requests", true);
      const list = r ? JSON.parse(r.value) : [];
      await supabaseStorage.set("user-requests", JSON.stringify([req, ...list].slice(0, 200)), true);
    } catch (e) {}
    showToast("Request sent to the admin!");
  }

  async function saveAnimeEpisodes(next) {
    setAnimeEpisodes(next);
    try {
      await supabaseStorage.set("anime-episodes", JSON.stringify(next), true);
    } catch (e) {}
  }

  function handleAnimeEpisodeUpload({ show, season, epNumber, dubType, title, description, videoUrl, thumbnailUrl }) {
    const ep = {
      id: generateId(),
      show,
      season,
      epNumber,
      dubType: dubType || "Sub",
      title: title.trim(),
      description: description.trim(),
      videoUrl: videoUrl.trim(),
      thumbnailUrl: thumbnailUrl.trim(),
      uploader: session.username,
      createdAt: Date.now(),
      views: 0,
    };
    saveAnimeEpisodes([ep, ...animeEpisodes]);
    setAnimeUploadOpen(false);
    showToast(`Episode posted: ${show} S${season}E${epNumber} (${dubType || "Sub"})`);
  }

  function handleAnimeEpisodeDelete(ep) {
    if (!isAdmin) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete S${ep.season}E${ep.epNumber} "${ep.title}"?`)) return;
    saveAnimeEpisodes(animeEpisodes.filter((e) => e.id !== ep.id));
    showToast("Episode deleted.");
  }

  function handleAnimeEpisodeView(ep) {
    saveAnimeEpisodes(animeEpisodes.map((e) => (e.id === ep.id ? { ...e, views: (e.views || 0) + 1 } : e)));
    window.open(ep.videoUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSetFeaturedCreator(username) {
    if (!isAdmin) return;
    setFeaturedCreator(username);
    try {
      await supabaseStorage.set("featured-creator", username, true);
    } catch (e) {}
    showToast(`@${username} is now featured creator of the week.`);
  }

  /* ---- auth ---- */
  function handleRegister(usernameRaw, emailRaw, password) {
    const username = usernameRaw.trim();
    const email = (emailRaw || "").trim();
    if (!username || !password) return setAuthError("Enter a username and password.");
    if (!email) return setAuthError("Enter an email address.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setAuthError("Enter a valid email address.");
    if (username.length > 24) return setAuthError("Keep usernames under 24 characters.");
    const taken = Object.keys(users).some((u) => u.toLowerCase() === username.toLowerCase());
    if (taken) return setAuthError("That username is taken.");
    const next = { ...users, [username]: { passwordHash: weakHash(password), email, joinedAt: Date.now(), bio: "", followers: [], following: [], verified: false } };
    saveUsers(next);
    saveSession({ username });
    setAuthOpen(false);
    setAuthError("");
    showToast(`Welcome, ${username} — ready to enter the vault.`);
  }

  function handleLogin(usernameRaw, password) {
    const username = usernameRaw.trim();
    const u = users[username];
    if (!u || u.passwordHash !== weakHash(password)) return setAuthError("Wrong username or password.");
    saveSession({ username });
    setAuthOpen(false);
    setAuthError("");
    showToast(`Welcome back, ${username}.`);
  }

  function handleLogout() {
    saveSession(null);
    setProfileOpen(false);
    showToast("Logged out.");
  }

  /* ---- profile ---- */
  function handleSaveBio(text) {
    if (!session) return;
    const u = users[session.username] || {};
    saveUsers({ ...users, [session.username]: { ...u, bio: text.slice(0, 280) } });
    showToast("Bio updated.");
  }

  async function handleSaveProfile({ displayName, bio, bannerColor, website }) {
    if (!session) return;
    const u = users[session.username] || {};
    await saveUsers({
      ...users,
      [session.username]: {
        ...u,
        displayName: displayName.trim().slice(0, 32),
        bio: bio.slice(0, 280),
        bannerColor,
        website: website.trim().slice(0, 100),
      },
    });
    showToast("Profile saved.");
  }

  function handleFollow(targetUsername) {
    if (!session || targetUsername === session.username) return;
    const me = users[session.username] || { following: [] };
    const them = users[targetUsername] || { followers: [] };
    const iFollow = (me.following || []).includes(targetUsername);
    const nextMe = { ...me, following: iFollow ? me.following.filter((u) => u !== targetUsername) : [...(me.following || []), targetUsername] };
    const nextThem = { ...them, followers: iFollow ? (them.followers || []).filter((u) => u !== session.username) : [...(them.followers || []), session.username] };
    saveUsers({ ...users, [session.username]: nextMe, [targetUsername]: nextThem });
    if (!iFollow) pushNotification(targetUsername, { type: "follow", fromUser: session.username });
  }

  function handleToggleVerified(targetUsername) {
    if (!isAdmin) return;
    const them = users[targetUsername] || {};
    saveUsers({ ...users, [targetUsername]: { ...them, verified: !them.verified } });
  }

  /* ---- edits ---- */
  async function handleUploadSubmit({ title, category, description, tags, videoUrl, file, thumbnailUrl, animeSource, musicCredit, mature }) {
    const id = generateId();
    let hasVideo = false;
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      await supabaseStorage.set(`edit-video:${id}`, dataUrl, true);
      hasVideo = true;
    }
    const post = {
      id,
      title: title.trim(),
      category,
      description: description.trim(),
      animeSource: animeSource.trim(),
      musicCredit: musicCredit.trim(),
      mature: !!mature,
      featured: false,
      pinned: false,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
      videoUrl: videoUrl.trim(),
      hasVideo,
      thumbnailUrl: thumbnailUrl.trim(),
      uploader: session.username,
      createdAt: Date.now(),
      downloads: 0,
      likes: 0,
      views: 0,
      likedBy: [],
      comments: [],
    };
    savePosts([post, ...posts]);
    setUploadOpen(false);
    showToast("Edit posted.");
  }

  async function handleDownload(post) {
    const next = posts.map((p) => (p.id === post.id ? { ...p, downloads: p.downloads + 1 } : p));
    savePosts(next);
    if (post.hasVideo) {
      try {
        const r = await supabaseStorage.get(`edit-video:${post.id}`, true);
        const src = r ? r.value : null;
        if (!src) return showToast("Video unavailable.");
        const a = document.createElement("a");
        a.href = src;
        a.download = `${post.title || "edit"}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        showToast("Couldn't load that video.");
      }
      return;
    }
    window.open(post.videoUrl, "_blank", "noopener,noreferrer");
  }

  function handleLike(post) {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    const liked = post.likedBy.includes(session.username);
    const next = posts.map((p) => {
      if (p.id !== post.id) return p;
      const likedBy = liked ? p.likedBy.filter((u) => u !== session.username) : [...p.likedBy, session.username];
      return { ...p, likedBy, likes: likedBy.length };
    });
    savePosts(next);
    if (!liked && post.uploader !== session.username) {
      pushNotification(post.uploader, { type: "like", fromUser: session.username, postId: post.id, postTitle: post.title });
    }
  }

  function handleTogglePin(post) {
    if (!session || post.uploader !== session.username) return;
    savePosts(posts.map((p) => (p.id === post.id ? { ...p, pinned: !p.pinned } : p)));
  }

  function handleAddComment(postId, text) {
    if (!session || !text.trim()) return;
    const comment = { id: generateId(), author: session.username, text: text.trim(), createdAt: Date.now() };
    const next = posts.map((p) => (p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p));
    savePosts(next);
    const post = posts.find((p) => p.id === postId);
    if (post && post.uploader !== session.username) {
      pushNotification(post.uploader, { type: "comment", fromUser: session.username, postId, postTitle: post.title });
    }
  }

  function handleDelete(post) {
    if (!session || post.uploader !== session.username) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete "${post.title}"? This can't be undone.`)) return;
    savePosts(posts.filter((p) => p.id !== post.id));
    if (detailPostId === post.id) setDetailPostId(null);
    showToast("Edit deleted.");
  }

  function handleToggleFeaturedPost(post) {
    if (!isAdmin) return;
    savePosts(posts.map((p) => (p.id === post.id ? { ...p, featured: !p.featured } : p)));
  }

  function openUploadFlow() {
    if (session) setUploadOpen(true);
    else {
      setAuthMode("login");
      setAuthOpen(true);
    }
  }

  function openDetail(postId) {
    setDetailPostId(postId);
    savePosts(posts.map((p) => (p.id === postId ? { ...p, views: (p.views || 0) + 1 } : p)));
  }

  function handleRandomEdit() {
    if (posts.length === 0) return showToast("No edits yet.");
    const pick = posts[Math.floor(Math.random() * posts.length)];
    openDetail(pick.id);
  }

  /* ---- wallpapers ---- */
  async function handleWallpaperUploadSubmit({ title, category, kind, style, orientation, mature, imageUrl, file }) {
    const id = generateId();
    let hasImage = false;
    if (file) {
      const dataUrl = await resizeImageFile(file);
      await supabaseStorage.set(`wallpaper-img:${id}`, dataUrl, true);
      hasImage = true;
    }
    const item = {
      id,
      title: title.trim(),
      category,
      kind,
      style,
      orientation,
      mature: !!mature,
      featured: false,
      uploader: session.username,
      createdAt: Date.now(),
      downloads: 0,
      likes: 0,
      likedBy: [],
      externalUrl: imageUrl ? imageUrl.trim() : "",
      hasImage,
    };
    await saveWallpapersIndex([item, ...wallpapers]);
    setWallpaperUploadOpen(false);
    showToast("Wallpaper posted.");
  }

  function handleWallpaperLike(w) {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    const liked = w.likedBy.includes(session.username);
    const next = wallpapers.map((p) => {
      if (p.id !== w.id) return p;
      const likedBy = liked ? p.likedBy.filter((u) => u !== session.username) : [...p.likedBy, session.username];
      return { ...p, likedBy, likes: likedBy.length };
    });
    saveWallpapersIndex(next);
  }

  async function handleWallpaperDownload(w) {
    const next = wallpapers.map((p) => (p.id === w.id ? { ...p, downloads: p.downloads + 1 } : p));
    saveWallpapersIndex(next);
    if (w.externalUrl) {
      window.open(w.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const r = await supabaseStorage.get(`wallpaper-img:${w.id}`, true);
      const src = r ? r.value : null;
      if (!src) return showToast("Image unavailable.");
      const a = document.createElement("a");
      a.href = src;
      a.download = `${w.title || "wallpaper"}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      showToast("Couldn't load that image.");
    }
  }

  async function handleWallpaperDelete(w) {
    if (!isAdmin) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete "${w.title}"? This can't be undone.`)) return;
    saveWallpapersIndex(wallpapers.filter((x) => x.id !== w.id));
    if (w.hasImage) {
      try {
        await supabaseStorage.delete(`wallpaper-img:${w.id}`, true);
      } catch (e) {}
    }
    showToast("Wallpaper deleted.");
  }

  function handleToggleFeaturedWallpaper(w) {
    if (!isAdmin) return;
    saveWallpapersIndex(wallpapers.map((p) => (p.id === w.id ? { ...p, featured: !p.featured } : p)));
  }

  function handleRandomWallpaper() {
    if (wallpapers.length === 0) return showToast("No wallpapers yet.");
    const pick = wallpapers[Math.floor(Math.random() * wallpapers.length)];
    handleWallpaperDownload(pick);
    showToast(`Surprise pick: ${pick.title}`);
  }

  const allAdmins = Array.from(new Set([...ADMIN_USERNAMES, ...dynamicAdmins]));
  const isAdmin = !!(session && allAdmins.includes(session.username.toLowerCase()));

  async function handleMakeAdmin(username) {
    if (!isAdmin) return;
    const clean = username.toLowerCase().trim();
    if (!clean) return;
    if (allAdmins.includes(clean)) return showToast(`@${clean} is already an admin.`);
    const next = [...dynamicAdmins, clean];
    setDynamicAdmins(next);
    try { await supabaseStorage.set("dynamic-admins", JSON.stringify(next), true); } catch (e) {}
    showToast(`@${clean} is now an admin.`);
  }

  async function handleRemoveAdmin(username) {
    if (!isAdmin) return;
    if (ADMIN_USERNAMES.includes(username)) return showToast("Can't remove a founding admin from the UI — edit the code.");
    const next = dynamicAdmins.filter((u) => u !== username);
    setDynamicAdmins(next);
    try { await supabaseStorage.set("dynamic-admins", JSON.stringify(next), true); } catch (e) {}
    showToast(`@${username} is no longer an admin.`);
  }

  function openWallpaperUploadFlow() {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    if (!isAdmin) {
      showToast("Only the admin account can add wallpapers.");
      return;
    }
    setWallpaperUploadOpen(true);
  }

  /* ---- favorites / report / block ---- */
  function handleFavoritePost(postId) {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    const has = favorites.posts.includes(postId);
    saveFavorites({ ...favorites, posts: has ? favorites.posts.filter((id) => id !== postId) : [...favorites.posts, postId] });
  }
  function handleFavoriteWallpaper(wallpaperId) {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    const has = favorites.wallpapers.includes(wallpaperId);
    saveFavorites({ ...favorites, wallpapers: has ? favorites.wallpapers.filter((id) => id !== wallpaperId) : [...favorites.wallpapers, wallpaperId] });
  }

  async function handleReport(targetType, targetId) {
    const reason = typeof window !== "undefined" ? window.prompt("Why are you reporting this? (visible to the admin)") : null;
    if (reason === null) return;
    try {
      const r = await supabaseStorage.get("reports", true);
      const list = r ? JSON.parse(r.value) : [];
      list.push({ id: generateId(), targetType, targetId, reason, reporter: session ? session.username : "anonymous", createdAt: Date.now() });
      await supabaseStorage.set("reports", JSON.stringify(list), true);
    } catch (e) {}
    showToast("Report submitted. Thanks for flagging it.");
  }

  function handleBlock(username) {
    if (blockedUsers.includes(username)) return showToast(`Already blocked @${username}.`);
    saveBlockedUsers([...blockedUsers, username]);
    setDetailPostId(null);
    showToast(`Blocked @${username}. Their posts are hidden from your feed.`);
  }

  function handleOpenProfile(username) {
    setProfileViewUsername(username);
  }

  async function markNotificationsRead() {
    if (!session || myNotifications.every((n) => n.read)) return;
    const next = myNotifications.map((n) => ({ ...n, read: true }));
    setMyNotifications(next);
    try {
      await supabaseStorage.set(`notifications:${session.username}`, JSON.stringify(next), true);
    } catch (e) {}
  }

  async function sendChatMessage() {
    if (!session) {
      setAuthMode("login");
      setAuthOpen(true);
      return;
    }
    const text = chatDraft.trim();
    if (!text) return;

    if (REALTIME_CHAT_ENABLED && socketRef.current) {
      // Real-time path: backend filters, saves, and broadcasts to everyone instantly
      socketRef.current.emit("chat:send", text);
      setChatDraft("");
      return;
    }

    // Fallback path: Supabase, filtered client-side, 4s poll for everyone else
    const clean = filterMessage(text);
    const msg = { id: generateId(), author: session.username, text: clean.slice(0, 500), createdAt: Date.now() };

    // Read fresh from storage so we never overwrite another user's message
    let base = chatMessages;
    try {
      const r = await supabaseStorage.get("chat-messages", true);
      if (r && r.value) base = JSON.parse(r.value);
    } catch (e) {}

    const next = [...base, msg].slice(-200);
    setChatMessages(next);
    setChatDraft("");
    try {
      await supabaseStorage.set("chat-messages", JSON.stringify(next), true);
    } catch (e) {
      showToast("Message couldn't save — try again.");
    }
  }

  /* ---- derived data ---- */
  const myFollowing = session ? users[session.username]?.following || [] : [];

  const allTags = ["All", ...Array.from(new Set(posts.flatMap((p) => p.tags)))];

  const visiblePosts = posts.filter((p) => !blockedUsers.includes(p.uploader));

  const filtered = visiblePosts.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
    const matchesTag = activeTag === "All" || p.tags.includes(activeTag);
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    const matchesFollowing = !followingOnly || myFollowing.includes(p.uploader);
    const matchesFavorites = !favoritesOnly || favorites.posts.includes(p.id);
    const matchesFeatured = !featuredOnly || p.featured;
    return matchesSearch && matchesTag && matchesCategory && matchesFollowing && matchesFavorites && matchesFeatured;
  });

  const sorted = [...filtered].sort((a, b) => (sortBy === "trending" ? b.downloads + b.likes * 2 - (a.downloads + a.likes * 2) : b.createdAt - a.createdAt));

  const trending = [...visiblePosts].sort((a, b) => b.downloads + b.likes * 2 - (a.downloads + a.likes * 2)).slice(0, 4);

  const totalDownloads = posts.reduce((s, p) => s + p.downloads, 0);
  const totalEditors = new Set(posts.map((p) => p.uploader)).size;

  const leaderboard = Object.entries(
    posts.reduce((acc, p) => {
      acc[p.uploader] = (acc[p.uploader] || 0) + p.downloads + p.likes;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const myPostsCount = session ? posts.filter((p) => p.uploader === session.username).length : 0;
  const detailPost = posts.find((p) => p.id === detailPostId) || null;
  const profileViewPostsCount = profileViewUsername ? posts.filter((p) => p.uploader === profileViewUsername).length : 0;

  const visibleWallpapers = wallpapers.filter((w) => !blockedUsers.includes(w.uploader));
  const filteredWallpapers = visibleWallpapers.filter((w) => {
    const matchesCategory = wallpaperCategory === "All" || w.category === wallpaperCategory;
    const matchesKind = wallpaperKind === "All" || w.kind === wallpaperKind;
    const matchesStyle = wallpaperStyle === "All" || w.style === wallpaperStyle;
    const matchesOrientation = wallpaperOrientation === "All" || w.orientation === wallpaperOrientation;
    const matchesFavorites = !favoritesOnly || favorites.wallpapers.includes(w.id);
    return matchesCategory && matchesKind && matchesStyle && matchesOrientation && matchesFavorites;
  });
  const totalWallpaperDownloads = wallpapers.reduce((s, w) => s + w.downloads, 0);

  const unreadNotifCount = myNotifications.filter((n) => !n.read).length;

  return (
    <div className={`vault-root min-h-screen text-fog ${theme !== "dark" ? theme : ""}`}>
      <style>{CSS}</style>
      <svg className="grain-overlay" aria-hidden="true">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <div className="vignette" aria-hidden="true" />

      <div className="scrub-track">
        <div ref={progressRef} className="scrub-fill" />
      </div>

      {/* nav */}
      <header className={`site-nav ${scrolled ? "site-nav-scrolled" : ""}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3.5">
          <a href="#top" onClick={() => switchView("edits")}>
            <Logo />
          </a>

          <div className="hidden md:flex items-center gap-2 ml-1 mr-auto pl-4">
            <span className="nav-divider" />
            <span className="mono-label text-dim">Aesthetic first. Always.</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 mono-label text-dim">
            {view !== "anime" && (
              <a href={view === "edits" ? "#browse" : "#wallpaper-grid"} className="nav-link">
                Browse
              </a>
            )}
            {view === "edits" && (
              <a href="#leaderboard" className="nav-link">
                Top editors
              </a>
            )}
            {((view === "edits") || (view === "wallpapers" && isAdmin) || (view === "anime" && isAdmin)) && (
              <button onClick={() => { if (view === "edits") openUploadFlow(); else if (view === "wallpapers") openWallpaperUploadFlow(); else setAnimeUploadOpen(true); }} className="nav-link">
                Upload
              </button>
            )}
            {view !== "anime" && (
              <button onClick={view === "edits" ? handleRandomEdit : handleRandomWallpaper} className="nav-link flex items-center gap-1">
                <Shuffle size={12} /> Random
              </button>
            )}
            <button onClick={() => setChatOpen(true)} className="nav-link flex items-center gap-1">
              <MessageCircle size={12} /> Chat
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-2 ml-6">
            <button onClick={cycleTheme} className="icon-toggle-btn" aria-label="Toggle theme" title={`Theme: ${theme}`}>
              {theme === "dark" ? <Sun size={16} /> : theme === "amoled" ? <Contrast size={16} /> : <Moon size={16} />}
            </button>
            {session && (
              <button
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen) markNotificationsRead();
                }}
                className="icon-toggle-btn relative"
                aria-label="Notifications"
              >
                <Bell size={16} />
                {unreadNotifCount > 0 && <span className="notif-dot" />}
              </button>
            )}
            {session && (
              <button onClick={() => setSettingsOpen(true)} className="icon-toggle-btn" aria-label="Settings">
                <Settings size={16} />
              </button>
            )}
            {session ? (
              <div className="relative">
                <button onClick={() => setProfileOpen((v) => !v)} className="avatar-btn" aria-label="Account menu">
                  <Avatar username={session.username} users={users} size={34} />
                </button>
                {profileOpen && (
                  <div className="profile-dropdown">
                    <p className="mono-label text-dim px-3 pt-2">
                      @{session.username} · {myPostsCount} posted
                    </p>
                    {isAdmin && <p className="mono-label text-red px-3 pt-1">Admin</p>}
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        handleOpenProfile(session.username);
                      }}
                      className="dropdown-item"
                    >
                      <Users size={14} /> View my profile
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); setEditProfileOpen(true); }}
                      className="dropdown-item"
                    >
                      <Camera size={14} /> Edit profile
                    </button>
                    <label className="dropdown-item cursor-pointer">
                      <input type="checkbox" checked={showMature} onChange={(e) => saveShowMature(e.target.checked)} />
                      Show mature content
                    </label>
                    <button onClick={handleLogout} className="dropdown-item">
                      <LogOut size={14} /> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                className="btn-primary-sm"
              >
                Sign in
              </button>
            )}
          </div>

          <button className="md:hidden text-fog" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Menu">
            <Menu size={22} />
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 px-5 py-3 flex flex-col gap-3 mono-label vault-mobile-menu">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                switchView("edits");
              }}
              className="nav-link text-left"
            >
              Home
            </button>
            <a href={view === "edits" ? "#browse" : "#wallpaper-grid"} onClick={() => setMobileMenuOpen(false)} className="nav-link">
              Browse
            </a>
            {view === "edits" && (
              <a href="#leaderboard" onClick={() => setMobileMenuOpen(false)} className="nav-link">
                Top editors
              </a>
            )}
            {((view === "edits") || (view === "wallpapers" && isAdmin) || (view === "anime" && isAdmin)) && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (view === "edits") openUploadFlow();
                  else if (view === "wallpapers") openWallpaperUploadFlow();
                  else setAnimeUploadOpen(true);
                }}
                className="nav-link text-left"
              >
                Upload
              </button>
            )}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setChatOpen(true);
              }}
              className="nav-link text-left"
            >
              Chat
            </button>
            {session && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setNotifOpen(true);
                  markNotificationsRead();
                }}
                className="nav-link text-left"
              >
                Notifications {unreadNotifCount > 0 ? `(${unreadNotifCount})` : ""}
              </button>
            )}
            {session && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setEditProfileOpen(true);
                }}
                className="nav-link text-left"
              >
                Edit profile
              </button>
            )}
            {session && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="nav-link text-left"
              >
                Settings
              </button>
            )}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                cycleTheme();
              }}
              className="nav-link text-left"
            >
              Theme: {theme === "dark" ? "Dark" : theme === "amoled" ? "AMOLED" : "Light"} (tap to change)
            </button>
            {session ? (
              <button onClick={handleLogout} className="nav-link text-left">
                Log out (@{session.username})
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                className="nav-link text-left"
              >
                Sign in
              </button>
            )}
          </div>
        )}
      </header>

      {/* tab switcher */}
      <div className="tab-bar">
        <div className="max-w-6xl mx-auto px-5 flex gap-2 py-2 overflow-x-auto">
          <button onClick={() => switchView("edits")} className={`tab-pill shrink-0 ${view === "edits" ? "tab-pill-active" : ""}`}>Anime Edits</button>
          <button onClick={() => switchView("wallpapers")} className={`tab-pill shrink-0 ${view === "wallpapers" ? "tab-pill-active" : ""}`}>Wallpapers</button>
          <button onClick={() => switchView("anime")} className={`tab-pill shrink-0 ${view === "anime" ? "tab-pill-active" : ""}`}>Anime</button>
          <button onClick={() => switchView("rawclips")} className={`tab-pill shrink-0 ${view === "rawclips" ? "tab-pill-active" : ""}`}>Raw Clips</button>
          <button onClick={() => switchView("premium")} className={`tab-pill shrink-0 ${view === "premium" ? "tab-pill-active" : ""}`}>⭐ Premium</button>
          <button onClick={() => switchView("requests")} className={`tab-pill shrink-0 ${view === "requests" ? "tab-pill-active" : ""}`}>💬 Requests</button>
          <button onClick={() => switchView("resolution")} className={`tab-pill shrink-0 ${view === "resolution" ? "tab-pill-active" : ""}`}>📐 Preview</button>
          <button onClick={() => switchView("downloads")} className={`tab-pill shrink-0 ${view === "downloads" ? "tab-pill-active" : ""}`}>Get the App</button>
        </div>
      </div>

      <div key={view} className="view-fade">
        {view === "edits" ? (
          <>
            {/* hero */}
            <section id="top" className="hero relative overflow-hidden">
              <div ref={heroBgRef} className="hero-bg" />
              <SakuraBranch />
              <div className="scanline-overlay" />
              {!prefersReducedMotion() &&
                PETALS.map((p, i) => <span key={i} className="petal" style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay }} />)}
              <div className="relative max-w-4xl mx-auto px-6 pt-44 pb-28 text-center">
                <Reveal>
                  <Eyebrow>VOL.01 // ARCHIVE_2026</Eyebrow>
                  <h1 className="hero-title mt-4">
                    CINEMATIC ANIME <span className="text-red">EDITS</span>
                  </h1>
                  <p className="text-fog text-base md:text-lg mt-5 max-w-lg mx-auto italic">Editing is a language. The cut is the soul.</p>
                  <p className="text-dim text-sm md:text-base mt-3 max-w-lg mx-auto">
                    Built for editors who treat a 30-second clip like a portfolio piece — frame timing, color grade, beat-locked transitions, no excuses.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <a href="#browse" className="btn-primary">
                      Enter the vault →
                    </a>
                    <button
                      onClick={() => {
                        setAuthMode("register");
                        setAuthOpen(true);
                      }}
                      className="btn-ghost-lg"
                    >
                      Create account
                    </button>
                  </div>
                  <div className="feature-badge mt-9">
                    <span className="feature-badge-dot" />
                    <div className="text-left">
                      <p className="mono-label text-fog">Cinema-grade clips</p>
                      <p className="mono-label text-dim">Built frame-first. No re-renders.</p>
                    </div>
                  </div>
                </Reveal>
              </div>
            </section>

            {/* stats */}
            <section className="border-y border-white/10 bg-panel">
              <Reveal>
                <div className="max-w-4xl mx-auto px-6 py-7 grid grid-cols-4 divide-x divide-white/10 text-center">
                  <div>
                    <p className="stat-number">{pad5(Object.keys(users).length)}</p>
                    <p className="mono-label text-dim mt-1">Users</p>
                  </div>
                  <div>
                    <p className="stat-number">{pad5(posts.length)}</p>
                    <p className="mono-label text-dim mt-1">Edits</p>
                  </div>
                  <div>
                    <p className="stat-number">{pad5(totalDownloads)}</p>
                    <p className="mono-label text-dim mt-1">Downloads</p>
                  </div>
                  <div>
                    <p className="stat-number">{pad5(posts.reduce((s, p) => s + (p.views || 0), 0))}</p>
                    <p className="mono-label text-dim mt-1">Total views</p>
                  </div>
                </div>
              </Reveal>
            </section>

            {/* featured creator of the week */}
            {featuredCreator && (
              <section className="max-w-6xl mx-auto px-5 pt-12">
                <Reveal>
                  <button onClick={() => handleOpenProfile(featuredCreator)} className="featured-creator-banner w-full text-left">
                    <Award size={22} className="text-red shrink-0" />
                    <div className="flex-1">
                      <p className="mono-label text-dim">FEATURED EDITOR OF THE WEEK</p>
                      <p className="font-logo text-lg text-fog tracking-tight mt-0.5 flex items-center gap-1.5">
                        @{featuredCreator} {users[featuredCreator]?.verified && <VerifiedMark />}
                      </p>
                    </div>
                    <Avatar username={featuredCreator} users={users} size={40} />
                  </button>
                </Reveal>
              </section>
            )}

            {/* trending */}
            <section className="max-w-6xl mx-auto px-5 py-20">
              <Reveal>
                <Eyebrow>VOL.02 // TRENDING NOW</Eyebrow>
                <h2 className="font-logo text-3xl text-fog tracking-tight mt-3 mb-7">
                  Trending <span className="text-red">edits</span>
                </h2>
              </Reveal>

              {trending.length === 0 ? (
                <Reveal delay={80}>
                  <EmptyState title="No edits yet" body="The trending rail fills up once the first edit lands. Be the one who starts it." ctaLabel="Upload the first edit" onCta={openUploadFlow} />
                </Reveal>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {trending.map((p, i) => (
                    <Reveal key={p.id} delay={i * 90}>
                      <PostCard
                        post={p}
                        session={session}
                        users={users}
                        isAdmin={isAdmin}
                        showMature={showMature}
                        favorited={favorites.posts.includes(p.id)}
                        featured={p.featured}
                        onDownload={handleDownload}
                        onLike={handleLike}
                        onFavorite={handleFavoritePost}
                        onOpenDetail={openDetail}
                        onOpenProfile={handleOpenProfile}
                        onDelete={handleDelete}
                        onToggleFeatured={handleToggleFeaturedPost}
                        onTogglePin={handleTogglePin}
                        featuredToggle
                      />
                    </Reveal>
                  ))}
                </div>
              )}
            </section>

            {/* browse-by-type carousels (mirrors the reference app's row layout) */}
            {EDIT_CATEGORIES.some((cat) => visiblePosts.some((p) => p.category === cat)) && (
              <section className="max-w-6xl mx-auto px-5 pb-6">
                <Reveal>
                  <Eyebrow>BROWSE BY TYPE</Eyebrow>
                </Reveal>
                {EDIT_CATEGORIES.map((cat) => {
                  const items = visiblePosts.filter((p) => p.category === cat).slice(0, 8);
                  return (
                    <Reveal key={cat} delay={30}>
                      <CarouselRow
                        title={cat}
                        items={items}
                        itemWidth={220}
                        onSeeAll={() => {
                          setActiveCategory(cat);
                          document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        renderItem={(p) => (
                          <PostCard
                            post={p}
                            session={session}
                            users={users}
                            isAdmin={isAdmin}
                            showMature={showMature}
                            favorited={favorites.posts.includes(p.id)}
                            featured={p.featured}
                            onDownload={handleDownload}
                            onLike={handleLike}
                            onFavorite={handleFavoritePost}
                            onOpenDetail={openDetail}
                            onOpenProfile={handleOpenProfile}
                            onDelete={handleDelete}
                            onToggleFeatured={handleToggleFeaturedPost}
                            onTogglePin={handleTogglePin}
                          />
                        )}
                      />
                    </Reveal>
                  );
                })}
              </section>
            )}

            {/* browse */}
            <section id="browse" className="max-w-6xl mx-auto px-5 py-20 border-t border-white/10">
              <Reveal>
                <h2 className="font-logo text-3xl md:text-4xl text-fog tracking-tight mb-1">
                  Browse <span className="text-red">edits</span>
                </h2>
                <div className="section-rule mb-6" />
              </Reveal>

              <Reveal delay={60}>
                <div className="search-bar mb-4">
                  <Search size={15} className="text-dim" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="SEARCH BY TITLE, TAG, OR EDITOR…"
                    className="bg-transparent outline-none text-sm text-fog placeholder:text-dim flex-1 uppercase-placeholder"
                  />
                </div>
              </Reveal>

              <Reveal delay={80}>
                <div className="flex flex-wrap items-center gap-2 mb-5">
                  {["recent", "trending"].map((s) => (
                    <button key={s} onClick={() => setSortBy(s)} className={`tag-filter ${sortBy === s ? "tag-filter-active" : ""}`}>
                      {s}
                    </button>
                  ))}
                  <span className="filter-divider" />
                  <button onClick={() => setFollowingOnly((v) => !v)} className={`tag-filter ${followingOnly ? "tag-filter-active" : ""}`} disabled={!session}>
                    Following
                  </button>
                  <button onClick={() => setFavoritesOnly((v) => !v)} className={`tag-filter ${favoritesOnly ? "tag-filter-active" : ""}`} disabled={!session}>
                    Favorites
                  </button>
                  <button onClick={() => setFeaturedOnly((v) => !v)} className={`tag-filter ${featuredOnly ? "tag-filter-active" : ""}`}>
                    Featured
                  </button>
                </div>
              </Reveal>

              <Reveal delay={100}>
                <div className="flex flex-wrap gap-2 mb-5">
                  {["All", ...EDIT_CATEGORIES].map((c) => (
                    <button key={c} onClick={() => setActiveCategory(c)} className={`tag-filter ${activeCategory === c ? "tag-filter-active" : ""}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </Reveal>

              {allTags.length > 1 && (
                <Reveal delay={120}>
                  <div className="flex flex-wrap gap-2 mb-9">
                    {allTags.map((t) => (
                      <button key={t} onClick={() => setActiveTag(t)} className={`tag-filter ${activeTag === t ? "tag-filter-active" : ""}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Reveal>
              )}

              {sorted.length === 0 ? (
                <Reveal>
                  <EmptyState
                    title={posts.length === 0 ? "Nothing posted yet" : undefined}
                    body={posts.length === 0 ? "This is where every edit on ANIMEVAULT will live. Upload one to get the library started." : "No edits match your filter."}
                    ctaLabel={posts.length === 0 ? "Upload an edit" : undefined}
                    onCta={openUploadFlow}
                  />
                </Reveal>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sorted.map((p, i) => (
                    <Reveal key={p.id} delay={(i % 6) * 70}>
                      <PostCard
                        post={p}
                        session={session}
                        users={users}
                        isAdmin={isAdmin}
                        showMature={showMature}
                        favorited={favorites.posts.includes(p.id)}
                        featured={p.featured}
                        onDownload={handleDownload}
                        onLike={handleLike}
                        onFavorite={handleFavoritePost}
                        onOpenDetail={openDetail}
                        onOpenProfile={handleOpenProfile}
                        onDelete={handleDelete}
                        onToggleFeatured={handleToggleFeaturedPost}
                        onTogglePin={handleTogglePin}
                      />
                    </Reveal>
                  ))}
                </div>
              )}
            </section>

            {/* leaderboard */}
            <section id="leaderboard" className="border-t border-white/10 bg-panel">
              <div className="max-w-3xl mx-auto px-5 py-20">
                <Reveal>
                  <Eyebrow>VOL.03 // RANKED BY ENGAGEMENT</Eyebrow>
                  <h2 className="font-logo text-3xl text-fog tracking-tight mt-3 mb-7">Top editors</h2>
                </Reveal>

                {leaderboard.length === 0 ? (
                  <Reveal delay={80}>
                    <EmptyState body="Editors get ranked here by downloads and likes across their posted edits." />
                  </Reveal>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map(([username, score], i) => (
                      <Reveal key={username} delay={i * 70}>
                        <button onClick={() => handleOpenProfile(username)} className="leaderboard-row w-full text-left">
                          <span className="mono-label text-dim w-8">{String(i + 1).padStart(2, "0")}</span>
                          <Avatar username={username} users={users} size={28} />
                          <span className="font-logo text-fog tracking-tight flex-1 flex items-center gap-1">
                            @{username} {users[username]?.verified && <VerifiedMark />}
                          </span>
                          <span className="mono-label text-red">{pad5(score)} pts</span>
                        </button>
                      </Reveal>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : view === "wallpapers" ? (
          <>
            {/* wallpapers hero */}
            <section className="max-w-6xl mx-auto px-5 pt-44 pb-10">
              <Reveal>
                <Eyebrow>VOL.04 // WALLPAPER VAULT</Eyebrow>
                <h2 className="font-logo text-3xl md:text-4xl text-fog tracking-tight mt-3 mb-2">
                  Wallpaper <span className="text-red">vault</span>
                </h2>
                <p className="text-dim text-sm max-w-xl">
                  Demon Slayer, Bleach, Genshin, Wuthering Waves and more — browse by world, download what fits your screen. Posted by the admin only; downloads are open to
                  everyone.
                </p>
              </Reveal>
            </section>

            <section className="border-y border-white/10 bg-panel">
              <Reveal>
                <div className="max-w-4xl mx-auto px-6 py-7 grid grid-cols-2 divide-x divide-white/10 text-center">
                  <div>
                    <p className="stat-number">{pad5(wallpapers.length)}</p>
                    <p className="mono-label text-dim mt-1">Wallpapers</p>
                  </div>
                  <div>
                    <p className="stat-number">{pad5(totalWallpaperDownloads)}</p>
                    <p className="mono-label text-dim mt-1">Downloads</p>
                  </div>
                </div>
              </Reveal>
            </section>

            {/* albums grid + request button */}
            <section className="max-w-6xl mx-auto px-5 pt-12 pb-4">
              <Reveal>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Eyebrow>ALBUMS</Eyebrow>
                    <h3 className="font-logo text-xl text-fog tracking-tight mt-1">Wallpaper collections</h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setRequestOpen(true)} className="btn-ghost">
                      💬 Request
                    </button>
                    {isAdmin && (
                      <button onClick={() => setCreateAlbumOpen(true)} className="btn-ghost">
                        + New album
                      </button>
                    )}
                  </div>
                </div>
                {wallpaperAlbums.length === 0 ? (
                  <p className="text-dim text-sm">{isAdmin ? "No albums yet — create one to organise wallpapers." : "Albums coming soon."}</p>
                ) : (
                  <div className="albums-grid">
                    {wallpaperAlbums.map((album, i) => (
                      <Reveal key={album.id} delay={i * 50}>
                        <WallpaperAlbumCard
                          album={album}
                          wallpapers={visibleWallpapers}
                          onOpen={(a) => { setWallpaperCategory(a.category || "All"); setActiveAlbum(a); document.getElementById("wallpaper-grid")?.scrollIntoView({ behavior: "smooth" }); }}
                          onDelete={handleDeleteAlbum}
                          isAdmin={isAdmin}
                        />
                      </Reveal>
                    ))}
                  </div>
                )}
              </Reveal>
            </section>

            {/* browse-by-title carousels (mirrors the reference app's row layout) */}
            {WALLPAPER_CATEGORIES.some((cat) => visibleWallpapers.some((w) => w.category === cat)) && (
              <section className="max-w-6xl mx-auto px-5 pt-12">
                <Reveal>
                  <Eyebrow>BROWSE BY TITLE</Eyebrow>
                </Reveal>
                {WALLPAPER_CATEGORIES.map((cat) => {
                  const items = visibleWallpapers.filter((w) => w.category === cat).slice(0, 10);
                  return (
                    <Reveal key={cat} delay={30}>
                      <CarouselRow
                        title={cat}
                        items={items}
                        itemWidth={150}
                        onSeeAll={() => {
                          setWallpaperCategory(cat);
                          document.getElementById("wallpaper-grid")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        renderItem={(w) => (
                          <WallpaperCard
                            wallpaper={w}
                            session={session}
                            isAdmin={isAdmin}
                            showMature={showMature}
                            favorited={favorites.wallpapers.includes(w.id)}
                            featured={w.featured}
                            onDownload={handleWallpaperDownload}
                            onLike={handleWallpaperLike}
                            onFavorite={handleFavoriteWallpaper}
                            onDelete={handleWallpaperDelete}
                            onToggleFeatured={handleToggleFeaturedWallpaper}
                          />
                        )}
                      />
                    </Reveal>
                  );
                })}
              </section>
            )}

            <section id="wallpaper-grid" className="max-w-6xl mx-auto px-5 py-16">
              {wallpapers.length === 0 && !isAdmin ? (
                <Reveal>
                  <div className="coming-soon-card">
                    <Film size={30} className="text-red mb-3" />
                    <p className="mono-label text-dim mb-2">WALLPAPER VAULT</p>
                    <h3 className="font-logo text-2xl text-fog tracking-tight mb-2">Coming soon</h3>
                    <p className="text-dim text-sm max-w-sm mx-auto">
                      The admin's still building out this collection — check back soon for Demon Slayer, Genshin, AMOLED, and more.
                    </p>
                  </div>
                </Reveal>
              ) : (
                <>
                  <Reveal>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                      <div className="flex flex-wrap gap-2">
                        {["All", ...WALLPAPER_KINDS].map((k) => (
                          <button key={k} onClick={() => setWallpaperKind(k)} className={`tag-filter ${wallpaperKind === k ? "tag-filter-active" : ""}`}>
                            {k}
                          </button>
                        ))}
                        <span className="filter-divider" />
                        <button onClick={() => setFavoritesOnly((v) => !v)} className={`tag-filter ${favoritesOnly ? "tag-filter-active" : ""}`} disabled={!session}>
                          Favorites
                        </button>
                      </div>
                      {isAdmin ? (
                        <button onClick={openWallpaperUploadFlow} className="btn-ghost shrink-0">
                          <UploadIcon size={14} /> Upload wallpaper
                        </button>
                      ) : (
                        <span className="curator-badge shrink-0">Curated by the admin</span>
                      )}
                    </div>
                  </Reveal>

                  <Reveal delay={60}>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {["All", ...WALLPAPER_STYLES].map((s) => (
                        <button key={s} onClick={() => setWallpaperStyle(s)} className={`tag-filter ${wallpaperStyle === s ? "tag-filter-active" : ""}`}>
                          {s}
                        </button>
                      ))}
                      <span className="filter-divider" />
                      {["All", ...ORIENTATIONS].map((o) => (
                        <button key={o} onClick={() => setWallpaperOrientation(o)} className={`tag-filter ${wallpaperOrientation === o ? "tag-filter-active" : ""}`}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </Reveal>

                  <Reveal delay={80}>
                    <div className="flex flex-wrap gap-2 mb-9">
                      {["All", ...WALLPAPER_CATEGORIES].map((c) => (
                        <button key={c} onClick={() => setWallpaperCategory(c)} className={`tag-filter ${wallpaperCategory === c ? "tag-filter-active" : ""}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </Reveal>

                  {filteredWallpapers.length === 0 ? (
                    <Reveal>
                      <EmptyState
                        title={wallpapers.length === 0 ? "No wallpapers yet" : undefined}
                        body={
                          wallpapers.length === 0
                            ? "This vault fills up once you add the first one."
                            : "No wallpapers match this filter."
                        }
                        ctaLabel={isAdmin ? "Upload a wallpaper" : undefined}
                        onCta={openWallpaperUploadFlow}
                      />
                    </Reveal>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                      {filteredWallpapers.map((w, i) => (
                        <Reveal key={w.id} delay={(i % 8) * 60}>
                          <WallpaperCard
                            wallpaper={w}
                            session={session}
                            isAdmin={isAdmin}
                            showMature={showMature}
                            favorited={favorites.wallpapers.includes(w.id)}
                            featured={w.featured}
                            onDownload={handleWallpaperDownload}
                            onLike={handleWallpaperLike}
                            onFavorite={handleFavoriteWallpaper}
                            onDelete={handleWallpaperDelete}
                            onToggleFeatured={handleToggleFeaturedWallpaper}
                          />
                        </Reveal>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        ) : view === "anime" ? (
          <>
            {/* anime hero */}
            <section className="max-w-6xl mx-auto px-5 pt-44 pb-8">
              <Reveal>
                <Eyebrow>VOL.05 // ANIME LIBRARY</Eyebrow>
                <h2 className="font-logo text-3xl md:text-4xl text-fog tracking-tight mt-3 mb-2">
                  Anime <span className="text-red">library</span>
                </h2>
                <p className="text-dim text-sm max-w-xl">
                  Episodes and news curated by the admin. Only @Uzzy can post — everyone can browse and watch.
                </p>
              </Reveal>
            </section>

            {/* anime sub-tabs */}
            <div className="max-w-6xl mx-auto px-5 mb-8">
              <div className="flex gap-2">
                {ANIME_SUBTABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setAnimeSubTab(t)}
                    className={`tab-pill ${animeSubTab === t ? "tab-pill-active" : ""}`}
                  >
                    {t}
                  </button>
                ))}
                {isAdmin && (
                  <button onClick={() => setAnimeUploadOpen(true)} className="btn-ghost ml-auto">
                    <UploadIcon size={14} /> Add episode
                  </button>
                )}
              </div>
            </div>

            {animeSubTab === "Episodes" ? (
              <section className="max-w-6xl mx-auto px-5 pb-20">
                {animeEpisodes.length === 0 ? (
                  <Reveal>
                    <AnimeEpisodes />
                   </Reveal>
                ) : (
                  <>
                    <Reveal>
                      <div className="flex flex-wrap gap-2 mb-5">
                        {["All", ...Array.from(new Set(animeEpisodes.map((e) => e.show)))].map((s) => (
                          <button key={s} onClick={() => { setAnimeShowFilter(s); setAnimeSeasonFilter("All"); }} className={`tag-filter ${animeShowFilter === s ? "tag-filter-active" : ""}`}>{s}</button>
                        ))}
                      </div>
                    </Reveal>
                    {/* Sub / Dub filter */}
                    <Reveal delay={30}>
                      <div className="flex gap-2 mb-5">
                        {["All", "Sub", "Dub", "Both"].map((d) => (
                          <button key={d} onClick={() => setAnimeDubFilter(d)} className={`tag-filter ${animeDubFilter === d ? "tag-filter-active" : ""}`}>{d}</button>
                        ))}
                      </div>
                    </Reveal>
                    {animeShowFilter !== "All" && (
                      <Reveal delay={40}>
                        <div className="flex flex-wrap gap-2 mb-7">
                          {["All", ...Array.from(new Set(animeEpisodes.filter((e) => e.show === animeShowFilter).map((e) => e.season))).sort((a, b) => Number(a) - Number(b))].map((s) => (
                            <button key={s} onClick={() => setAnimeSeasonFilter(String(s))} className={`tag-filter ${animeSeasonFilter === String(s) ? "tag-filter-active" : ""}`}>
                              {s === "All" ? "All seasons" : `Season ${s}`}
                            </button>
                          ))}
                        </div>
                      </Reveal>
                    )}
                    {animeShowFilter === "All" ? (
                      ANIME_SHOWS.filter((show) => animeEpisodes.some((e) => e.show === show && (animeDubFilter === "All" || (e.dubType || "Sub") === animeDubFilter))).map((show) => {
                        const eps = animeEpisodes.filter((e) => e.show === show && (animeDubFilter === "All" || (e.dubType || "Sub") === animeDubFilter));
                        return (
                          <Reveal key={show} delay={30}>
                            <CarouselRow title={show} items={eps.sort((a, b) => Number(a.season) * 1000 + Number(a.epNumber) - (Number(b.season) * 1000 + Number(b.epNumber)))} itemWidth={220} onSeeAll={() => { setAnimeShowFilter(show); setAnimeSeasonFilter("All"); }} renderItem={(ep) => <EpisodeCard ep={ep} isAdmin={isAdmin} onView={handleAnimeEpisodeView} onDelete={handleAnimeEpisodeDelete} />} />
                          </Reveal>
                        );
                      })
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {animeEpisodes.filter((e) => e.show === animeShowFilter && (animeSeasonFilter === "All" || String(e.season) === animeSeasonFilter) && (animeDubFilter === "All" || (e.dubType || "Sub") === animeDubFilter)).sort((a, b) => Number(a.season) * 1000 + Number(a.epNumber) - (Number(b.season) * 1000 + Number(b.epNumber))).map((ep, i) => (
                          <Reveal key={ep.id} delay={(i % 6) * 60}>
                            <EpisodeCard ep={ep} isAdmin={isAdmin} onView={handleAnimeEpisodeView} onDelete={handleAnimeEpisodeDelete} />
                          </Reveal>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : animeSubTab === "Trending" ? (
              <section className="max-w-6xl mx-auto px-5 pb-20">
                <Reveal>
                  <Eyebrow>LIVE FROM MYANIMELIST</Eyebrow>
                  <h2 className="font-logo text-2xl text-fog tracking-tight mt-2 mb-6">
                    Trending <span className="text-red">anime</span>
                  </h2>
                </Reveal>
                <TrendingAnimeView />
              </section>
            ) : (
              <section className="max-w-6xl mx-auto px-5 pb-20">
                <Reveal>
                  <Eyebrow>SEASONAL UPDATES</Eyebrow>
                  <h2 className="font-logo text-2xl text-fog tracking-tight mt-2 mb-6">
                    Anime <span className="text-red">news</span>
                  </h2>
                </Reveal>
                <AnimeNewsView />
              </section>
            )}
          </>
        ) : view === "rawclips" ? (
          /* ── RAW CLIPS TAB ── */
          <section className="max-w-6xl mx-auto px-5 pt-44 pb-28">
            <Reveal>
              <Eyebrow>VOL.06 // RAW FOOTAGE</Eyebrow>
              <h2 className="font-logo text-3xl md:text-4xl text-fog tracking-tight mt-3 mb-8">
                Raw <span className="text-red">clips</span>
              </h2>
              <div className="coming-soon-card">
                <Film size={30} className="text-red mb-3" />
                <p className="mono-label text-dim mb-2">ADMIN ONLY — RAW FOOTAGE VAULT</p>
                <h3 className="font-logo text-2xl text-fog tracking-tight mb-2">Coming soon</h3>
                <p className="text-dim text-sm max-w-md mx-auto">
                  @Uzzy will be uploading raw anime clips here for editors to use in their edits — unedited fight scenes, openings, transitions, and more. Check back soon.
                </p>
              </div>
            </Reveal>
          </section>
        ) : view === "downloads" ? (
          /* ── GET THE APP / DOWNLOADS TAB ── */
          <section className="max-w-3xl mx-auto px-5 pt-44 pb-28">
            <Reveal>
              <Eyebrow>VOL.07 // INSTALL</Eyebrow>
              <h2 className="font-logo text-3xl text-fog tracking-tight mt-3 mb-8">
                Get <span className="text-red">ANIMEVAULT</span>
              </h2>

              {/* Install as web app (PWA) */}
              <div className="download-card mb-5">
                <h3 className="font-logo text-xl text-fog tracking-tight mb-1">📱 iPhone / Android</h3>
                <p className="text-dim text-sm leading-relaxed mb-3">
                  Open this page in <strong className="text-fog">Safari (iPhone)</strong> or <strong className="text-fog">Chrome (Android)</strong> → tap the Share button → tap <strong className="text-fog">"Add to Home Screen"</strong> → tap Add. The app installs on your home screen instantly, works offline, and looks and feels like a native app. Free, no App Store needed.
                </p>
                <span className="news-cat-badge">No download required</span>
              </div>

              <div className="download-card mb-5">
                <h3 className="font-logo text-xl text-fog tracking-tight mb-1">💻 Desktop (Chrome / Edge)</h3>
                <p className="text-dim text-sm leading-relaxed mb-3">
                  Open the app in Chrome or Edge → click the <strong className="text-fog">install icon</strong> (⊕) in the address bar → click Install. Launches like a standalone app, appears in your dock/taskbar.
                </p>
                <span className="news-cat-badge">No download required</span>
              </div>

              <div className="download-card mb-5">
                <h3 className="font-logo text-xl text-fog tracking-tight mb-1">🖥 Desktop App (coming soon)</h3>
                <p className="text-dim text-sm leading-relaxed mb-3">
                  Full desktop builds (macOS .dmg, Windows .exe, Linux .deb) are coming once the app is deployed to its own domain. When they're ready, download links will appear here.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="tag-filter opacity-50 cursor-default">macOS .dmg — coming soon</span>
                  <span className="tag-filter opacity-50 cursor-default">Windows .exe — coming soon</span>
                  <span className="tag-filter opacity-50 cursor-default">Linux .deb — coming soon</span>
                </div>
              </div>

              <div className="download-card">
                <h3 className="font-logo text-xl text-fog tracking-tight mb-1">⚡ Developer install (CLI)</h3>
                <p className="text-dim text-sm mb-3">Once deployed to your domain, users can install via:</p>
                <pre className="download-code">npm install -g animevault-cli</pre>
                <pre className="download-code">animevault start</pre>
                <span className="news-cat-badge mt-2 inline-block">Coming after deployment</span>
              </div>
            </Reveal>
          </section>
        ) : view === "premium" ? (
          /* ── PREMIUM WALLPAPERS TAB ── */
          <section className="max-w-3xl mx-auto px-5 pt-44 pb-28">
            <Reveal>
              <Eyebrow>EXCLUSIVE ACCESS</Eyebrow>
              <h2 className="font-logo text-3xl md:text-4xl text-fog tracking-tight mt-3 mb-8">
                Premium <span className="text-red">wallpapers</span>
              </h2>
              <div className="coming-soon-card">
                <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
                <p className="mono-label text-dim mb-2">EXCLUSIVE CONTENT VAULT</p>
                <h3 className="font-logo text-2xl text-fog tracking-tight mb-3">Coming soon</h3>
                <p className="text-dim text-sm max-w-md mx-auto leading-relaxed">
                  High-resolution 4K exclusive wallpapers, animated live wallpapers, and early access to new drops — all in one premium collection. @Uzzy will be curating this vault personally.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {["4K Ultra HD", "Animated Live", "Exclusive drops", "Early access", "No ads"].map((f) => (
                    <span key={f} className="badge-pill">{f}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          </section>
        ) : view === "requests" ? (
          /* ── GENERAL REQUESTS / HELP TAB ── */
          <RequestsTab session={session} showToast={showToast} />
        ) : (
          /* ── RESOLUTION PREVIEW TAB ── */
          <ResolutionPreviewTab />
        )}
      </div>

      {/* footer */}
      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-3">
          <Logo size="text-base" />
          <p className="mono-label text-dim text-center md:text-right">
            Accounts, edits and wallpapers live in this page's shared storage — anyone who opens it shares the same library.
          </p>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        mode={authMode}
        setMode={setAuthMode}
        onClose={() => {
          setAuthOpen(false);
          setAuthError("");
        }}
        onLogin={handleLogin}
        onRegister={handleRegister}
        error={authError}
        clearError={() => setAuthError("")}
      />
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onSubmit={handleUploadSubmit} myPosts={session ? posts.filter((p) => p.uploader === session.username) : []} />
      <WallpaperUploadModal open={wallpaperUploadOpen} onClose={() => setWallpaperUploadOpen(false)} onSubmit={handleWallpaperUploadSubmit} />
      <AnimeEpisodeUploadModal open={animeUploadOpen} onClose={() => setAnimeUploadOpen(false)} onSubmit={handleAnimeEpisodeUpload} />
      <EditProfileModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        session={session}
        users={users}
        onSave={handleSaveProfile}
        onAvatarFile={handleAvatarFile}
        isAdmin={isAdmin}
        onMakeAdmin={handleMakeAdmin}
        onRemoveAdmin={handleRemoveAdmin}
        adminUsernames={allAdmins}
      />
      <RequestModal open={requestOpen} onClose={() => setRequestOpen(false)} session={session} onSubmit={handleSendRequest} />
      <CreateAlbumModal open={createAlbumOpen} onClose={() => setCreateAlbumOpen(false)} onSubmit={handleCreateAlbum} categories={WALLPAPER_CATEGORIES} />
      <PostDetailModal
        post={detailPost}
        session={session}
        users={users}
        onClose={() => setDetailPostId(null)}
        onDownload={handleDownload}
        onLike={handleLike}
        onAddComment={handleAddComment}
        onReport={handleReport}
        onBlock={handleBlock}
        onOpenProfile={handleOpenProfile}
      />
      <ProfileModal
        username={profileViewUsername}
        users={users}
        posts={posts}
        session={session}
        isAdmin={isAdmin}
        postsCount={profileViewPostsCount}
        onClose={() => setProfileViewUsername(null)}
        onFollow={handleFollow}
        onSaveBio={handleSaveBio}
        onToggleVerified={handleToggleVerified}
        onAvatarFile={handleAvatarFile}
        onSetFeaturedCreator={handleSetFeaturedCreator}
        onOpenDetail={openDetail}
      />
      <NotificationsPanel
        open={notifOpen}
        notifications={myNotifications}
        onClose={() => setNotifOpen(false)}
        onOpenProfile={(u) => {
          setNotifOpen(false);
          handleOpenProfile(u);
        }}
        onOpenPost={(id) => {
          setNotifOpen(false);
          openDetail(id);
        }}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        notifSettings={notifSettings}
        onSaveNotifSettings={saveNotifSettings}
        theme={theme}
        onCycleTheme={cycleTheme}
        showMature={showMature}
        onSaveShowMature={saveShowMature}
      />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        session={session}
        draft={chatDraft}
        setDraft={setChatDraft}
        onSend={sendChatMessage}
      />
      <Toast message={toast} />

      {/* draggable floating chat button */}
      <DraggableChatFab
        chatOpen={chatOpen}
        hasMessages={chatMessages.length > 0}
        onToggle={() => setChatOpen((v) => !v)}
      />

      <div className="watermark">by Uzzy</div>
      <LoadingScreen ready={dataLoaded} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* styles                                                                 */
/* ---------------------------------------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

.vault-root {
  --bg: #0A0A0B; --panel: #121012; --fog: #EDEBEA; --dim: #8A8588;
  --border: rgba(255,255,255,0.14); --field-bg: #0A0A0B; --glass-bg: rgba(255,255,255,0.06);
  --glass-border: rgba(255,255,255,0.16);
  background: var(--bg);
  font-family: 'Inter', sans-serif;
  position: relative;
}
.vault-root.light {
  --bg: #F3EEEA; --panel: #E8E1DB; --fog: #1B1819; --dim: #6b6568;
  --border: rgba(0,0,0,0.12); --field-bg: #ffffff; --glass-bg: rgba(255,255,255,0.55);
  --glass-border: rgba(0,0,0,0.08);
}
.vault-root.amoled {
  --bg: #000000; --panel: #050505; --fog: #ffffff; --dim: #8a8a8a;
  --border: rgba(255,255,255,0.12); --field-bg: #000000; --glass-bg: rgba(255,255,255,0.045);
  --glass-border: rgba(255,255,255,0.12);
}
.font-logo { font-family: 'Archivo Black', sans-serif; }
.mono-label { font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; }
.text-fog { color: var(--fog); }
.text-dim { color: var(--dim); }
.text-red { color: #E8283F; }
.bg-panel { background: var(--panel); }

html { scroll-behavior: smooth; }

/* grain + vignette */
.grain-overlay { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay; }
.vignette { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(ellipse at 50% 0%, transparent 55%, rgba(0,0,0,0.45) 100%); }
.light .vignette { background: radial-gradient(ellipse at 50% 0%, transparent 60%, rgba(0,0,0,0.08) 100%); }

/* scrub bar */
.scrub-track { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.06); z-index: 60; }
.scrub-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #2DE2E6, #E8283F); }

/* logo */
.logo-mark {
  width: 30px; height: 30px; border-radius: 8px; background: #E8283F; color: #fff;
  font-family: 'Archivo Black', sans-serif; font-size: 0.95rem;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.nav-divider { width: 1px; height: 16px; background: var(--border); }

/* eyebrow */
.eyebrow { display: inline-flex; align-items: center; gap: 10px; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--dim); }
.eyebrow-dash { width: 18px; height: 2px; background: #E8283F; display: inline-block; flex-shrink: 0; }

/* liquid glass chrome */
.glass-surface {
  background: var(--glass-bg);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border: 1px solid var(--glass-border);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 10px 30px rgba(0,0,0,0.3);
}

/* nav */
.site-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; transition: background-color .3s, border-color .3s, backdrop-filter .3s; border-bottom: 1px solid transparent; }
.site-nav-scrolled { background: var(--glass-bg); backdrop-filter: blur(22px) saturate(160%); -webkit-backdrop-filter: blur(22px) saturate(160%); border-bottom: 1px solid var(--glass-border); }
.nav-link { font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); transition: color .2s; }
.nav-link:hover { color: var(--fog); }
.vault-mobile-menu { background: var(--glass-bg); backdrop-filter: blur(22px) saturate(160%); }
.icon-toggle-btn { color: var(--dim); padding: 6px; border-radius: 999px; transition: color .15s, background-color .15s; }
.icon-toggle-btn:hover { color: var(--fog); background: rgba(255,255,255,0.08); }

/* tab switcher */
.tab-bar { position: sticky; top: 60px; z-index: 45; background: var(--glass-bg); backdrop-filter: blur(22px) saturate(160%); -webkit-backdrop-filter: blur(22px) saturate(160%); border-bottom: 1px solid var(--glass-border); }

/* device switcher bar */
.device-bar { position: sticky; top: calc(60px + 44px); z-index: 44; background: var(--glass-bg); backdrop-filter: blur(16px); border-bottom: 1px solid var(--glass-border); }
.device-pill { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); padding: 5px 12px; border-radius: 999px; transition: color .15s, background-color .15s; }
.device-pill-active { color: var(--fog); background: rgba(255,255,255,0.1); }

/* device frame outer container */
.device-frame-bg { background: #000; min-height: 100vh; padding: 24px 16px 40px; display: flex; justify-content: center; align-items: flex-start; }
.device-frame-inner { background: var(--bg); border-radius: 20px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.7); transition: width .4s cubic-bezier(.16,1,.3,1); width: 100%; }
.device-phone { width: 393px; min-width: 393px; }
.device-tablet { width: 820px; min-width: 820px; }
.device-desktop { width: 1280px; min-width: min(1280px, 95vw); }
.device-chrome { background: #1a1a1a; border-bottom: 1px solid rgba(255,255,255,0.1); }
.device-chrome-bar { display: flex; align-items: center; padding: 10px 14px; gap: 6px; }
.device-chrome-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
.device-screen { overflow-y: auto; max-height: 85vh; }
#top, #browse, #leaderboard, #wallpaper-grid { scroll-margin-top: 156px; }
.tab-pill { font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); padding: 9px 18px; border-radius: 999px; transition: color .15s, background-color .15s, box-shadow .15s; }
.tab-pill-active { color: #fff; background: #E8283F; box-shadow: 0 0 16px rgba(232,40,63,0.35); }

/* tab crossfade */
.view-fade { animation: viewFadeIn 0.45s cubic-bezier(.16,1,.3,1); }
@keyframes viewFadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

/* hero */
.hero-bg {
  position: absolute; inset: -10% -10% -30% -10%;
  background:
    radial-gradient(circle at 22% 22%, rgba(232,40,63,0.20), transparent 55%),
    radial-gradient(circle at 78% 62%, rgba(45,226,230,0.08), transparent 50%),
    radial-gradient(circle at 50% 95%, rgba(0,0,0,0.5), transparent 60%);
  will-change: transform;
}
.hero-title { font-family: 'Archivo Black', sans-serif; font-size: clamp(2.3rem, 8vw, 4.6rem); line-height: 1.05; color: var(--fog); }
.section-rule { height: 1px; background: var(--border); margin-top: 18px; }
.feature-badge { display: inline-flex; align-items: center; gap: 12px; border-radius: 14px; padding: 12px 18px; }
.feature-badge-dot { width: 9px; height: 9px; background: #E8283F; border-radius: 2px; flex-shrink: 0; }

/* sakura art */
.sakura-wrap { position: absolute; top: -8%; right: -10%; width: 62%; max-width: 480px; height: auto; pointer-events: none; z-index: 0; }
.sakura-glow { position: absolute; top: 10%; right: 10%; width: 60%; height: 50%; background: radial-gradient(circle, rgba(247,205,217,0.22), transparent 70%); filter: blur(20px); }
.sakura-branch { width: 100%; height: auto; opacity: 0.62; filter: blur(1.1px) saturate(0.9) brightness(0.92); }
@media (max-width: 768px) { .sakura-wrap { width: 86%; top: -4%; right: -14%; } .sakura-branch { opacity: 0.42; } }

/* sakura petals */
.petal { position: absolute; top: -4%; width: 8px; height: 10px; background: linear-gradient(135deg, #ffb6c4, #E8283F); border-radius: 60% 0 60% 0; opacity: 0.4; animation: petal-fall linear infinite; pointer-events: none; }
@keyframes petal-fall { 0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; } 10% { opacity: 0.4; } 100% { transform: translateY(560px) translateX(40px) rotate(280deg); opacity: 0; } }

/* glitch kanji */
.glitch-title { position: relative; font-family: 'Archivo Black', sans-serif; font-size: clamp(3.4rem, 22vw, 8rem); color: #EDEBEA; line-height: 1; margin-top: 14px; }
.glitch-title::before, .glitch-title::after { content: attr(data-text); position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.glitch-title::before { color: #2DE2E6; clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); transform: translate(-3px, -2px); animation: glitch-a 2.6s infinite steps(1); mix-blend-mode: screen; }
.glitch-title::after { color: #E8283F; clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%); transform: translate(3px, 2px); animation: glitch-b 2.6s infinite steps(1); mix-blend-mode: screen; }
@keyframes glitch-a { 0%, 92%, 100% { transform: translate(-3px,-2px); } 93% { transform: translate(4px,2px); } 95% { transform: translate(-5px,1px); } 97% { transform: translate(2px,-3px); } }
@keyframes glitch-b { 0%, 90%, 100% { transform: translate(3px,2px); } 91% { transform: translate(-4px,-1px); } 94% { transform: translate(5px,3px); } 96% { transform: translate(-2px,2px); } }

/* loading screen */
.loading-screen { position: fixed; inset: 0; z-index: 100; background: #0A0A0B; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; text-align: center; padding: 24px; transition: opacity .5s ease; }
.loading-fade-out { opacity: 0; pointer-events: none; }
.loading-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; letter-spacing: 0.22em; color: #8A8588; }
.loading-sub { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; letter-spacing: 0.22em; color: #8A8588; text-transform: uppercase; margin-top: 6px; }
.render-bar-track { width: min(320px, 64vw); height: 3px; background: #1c1a1c; border-radius: 2px; overflow: hidden; margin-top: 26px; }
.render-bar-fill { height: 100%; background: #E8283F; }
.render-label { margin-top: 12px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em; font-size: 0.72rem; color: #8A8588; text-transform: uppercase; }
.scanline-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 1; background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px); mix-blend-mode: overlay; }

/* buttons — liquid glass + all caps */
.btn-primary, .btn-primary-sm, .btn-ghost, .btn-ghost-lg { text-transform: uppercase; letter-spacing: 0.06em; }
.btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #E8283F; color: #fff; padding: 12px 26px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; box-shadow: inset 0 1px 0 rgba(255,255,255,0.3); transition: transform .15s ease, background-color .15s ease, box-shadow .15s ease; }
.btn-primary:hover { background: #ff3a52; transform: translateY(-1px) scale(1.02); box-shadow: 0 8px 24px rgba(232,40,63,0.35), inset 0 1px 0 rgba(255,255,255,0.3); }
.btn-primary-sm { background: #E8283F; color: #fff; padding: 7px 18px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.btn-primary-sm:hover { background: #ff3a52; }
.btn-ghost { display: inline-flex; align-items: center; gap: 6px; background: var(--glass-bg); backdrop-filter: blur(14px); border: 1px solid var(--glass-border); color: var(--fog); padding: 7px 16px; border-radius: 999px; font-size: 0.75rem; font-weight: 500; transition: border-color .15s, background-color .15s, box-shadow .15s, transform .15s; }
.btn-ghost:hover { border-color: rgba(255,255,255,0.5); transform: translateY(-1px); box-shadow: 0 8px 18px rgba(0,0,0,0.25); }
.btn-ghost-lg { display: inline-flex; align-items: center; gap: 8px; background: var(--glass-bg); backdrop-filter: blur(14px); border: 1px solid var(--glass-border); color: var(--fog); padding: 12px 26px; border-radius: 999px; font-size: 0.8rem; font-weight: 500; transition: border-color .15s, background-color .15s, box-shadow .15s, transform .15s; }
.btn-ghost-lg:hover { border-color: rgba(255,255,255,0.6); transform: translateY(-1px); }

/* avatars */
.avatar-btn { width: 34px; height: 34px; border-radius: 999px; background: #E8283F; color: white; font-family: 'JetBrains Mono', monospace; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.avatar-circle { border-radius: 999px; color: white; font-family: 'JetBrains Mono', monospace; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.avatar-edit-btn { position: absolute; bottom: -2px; right: -2px; width: 22px; height: 22px; border-radius: 999px; background: #E8283F; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid var(--bg); }
.hidden-file-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
.profile-dropdown { position: absolute; right: 0; top: calc(100% + 8px); background: var(--glass-bg); backdrop-filter: blur(24px) saturate(160%); border: 1px solid var(--glass-border); border-radius: 16px; min-width: 210px; padding: 4px 0 6px; box-shadow: 0 14px 34px rgba(0,0,0,0.4); }
.dropdown-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; font-size: 0.82rem; color: var(--fog); }
.dropdown-item:hover { background: rgba(255,255,255,0.08); }

/* cards */
.cut-card { position: relative; transition: transform .15s ease; }
.thumb { background-color: var(--panel); transition: box-shadow .25s ease; }
.thumb::after { content: ''; position: absolute; inset: 0; background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.14) 50%, transparent 60%); transform: translateX(-120%); transition: transform .6s ease; }
.cut-card:hover .thumb::after { transform: translateX(120%); }
.cut-card:hover .thumb { box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 18px 38px rgba(0,0,0,0.5); }
.play-orb { width: 46px; height: 46px; border-radius: 50%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); transition: transform .2s ease, background-color .2s ease; }
.cut-card:hover .play-orb { transform: scale(1.08); background: rgba(232,40,63,0.55); }
.card-icon-btn { background: rgba(0,0,0,0.55); border-radius: 999px; padding: 6px; color: #EDEBEA; transition: color .15s, opacity .15s; }

.tag-chip { font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); border: 1px solid var(--border); padding: 2px 7px; border-radius: 999px; }
.wallpaper-tag { position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.6); color: #EDEBEA; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
.kind-tag { position: absolute; bottom: 8px; right: 8px; background: rgba(232,40,63,0.75); color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; }
.category-tag { position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.6); color: #EDEBEA; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
.icon-btn { color: var(--dim); padding: 4px; transition: color .15s; }
.icon-btn:hover { color: var(--fog); }

.mature-blur { filter: blur(18px) brightness(0.5); }
.mature-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: #fff; padding: 0 16px; z-index: 2; }

.stat-number { font-family: 'JetBrains Mono', monospace; font-size: 1.9rem; font-weight: 600; color: var(--fog); letter-spacing: 0.02em; }
.curator-badge { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); border: 1px solid var(--border); padding: 7px 14px; border-radius: 999px; }

/* search / filters */
.search-bar { display: flex; align-items: center; gap: 8px; background: var(--glass-bg); backdrop-filter: blur(14px); border: 1px solid var(--glass-border); border-radius: 999px; padding: 11px 16px; }
.uppercase-placeholder::placeholder { text-transform: uppercase; letter-spacing: 0.08em; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; }
.filter-divider { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }
.tag-filter { font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 6px 14px; border-radius: 999px; transition: color .15s, border-color .15s, background-color .15s, box-shadow .15s; }
.tag-filter:disabled { opacity: 0.4; cursor: not-allowed; }
.tag-filter-active { color: #E8283F; border-color: #E8283F; box-shadow: 0 0 12px rgba(232,40,63,0.18); }

/* leaderboard */
.leaderboard-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--glass-bg); backdrop-filter: blur(10px); border: 1px solid var(--glass-border); border-radius: 16px; }

/* comments */
.comment-row { border-bottom: 1px solid var(--border); padding-bottom: 8px; }

/* empty state */
.empty-state { text-align: center; padding: 60px 24px; border: 1px solid var(--border); border-radius: 20px; }

/* modal — liquid glass */
.modal-backdrop { position: fixed; inset: 0; z-index: 90; background: rgba(4,4,5,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(6px); }
.modal-panel { position: relative; width: 100%; max-width: 440px; background: var(--glass-bg); backdrop-filter: blur(28px) saturate(160%); -webkit-backdrop-filter: blur(28px) saturate(160%); border: 1px solid var(--glass-border); border-radius: 22px; padding: 30px 28px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 20px 50px rgba(0,0,0,0.4); }
.modal-panel-lg { max-width: 580px; max-height: 85vh; overflow-y: auto; }
.modal-close { position: absolute; top: 18px; right: 18px; color: var(--dim); }
.modal-close:hover { color: var(--fog); }
.field-input { width: 100%; background: var(--field-bg); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; font-size: 0.88rem; color: var(--fog); }
.help-box { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px; padding: 12px 14px; }
.level-badge { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
.level-bronze { background: rgba(180,100,40,0.25); color: #d99a5b; }
.level-silver { background: rgba(180,180,190,0.22); color: #cfd2d8; }
.level-gold { background: rgba(232,180,40,0.22); color: #f0c14b; }
.badge-pill { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); border: 1px solid var(--border); padding: 4px 10px; border-radius: 999px; }
.notif-dot { position: absolute; top: -3px; right: -3px; width: 9px; height: 9px; background: #E8283F; border-radius: 999px; border: 2px solid var(--bg); }
.notif-row { padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 0.82rem; }
.notif-row:last-child { border-bottom: none; }
.notif-unread { background: rgba(232,40,63,0.07); }
/* chat drawer */
.chat-backdrop { position: fixed; inset: 0; z-index: 88; }
.chat-drawer { position: fixed; right: 0; top: 0; bottom: 0; width: min(360px, 100vw); z-index: 89; transform: translateX(100%); transition: transform 0.35s cubic-bezier(.16,1,.3,1); }
.chat-drawer-open { transform: translateX(0); }
.chat-drawer-inner { display: flex; flex-direction: column; height: 100%; background: var(--bg); border-left: 1px solid var(--glass-border); backdrop-filter: blur(28px) saturate(160%); }
.chat-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 16px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.chat-messages-area { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 14px 14px 4px; }
.chat-input-row { padding: 12px 14px 16px; border-top: 1px solid var(--border); flex-shrink: 0; display: flex; }
.chat-bubble { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 14px 14px 14px 4px; padding: 8px 12px; max-width: 85%; }
.chat-bubble-mine { align-self: flex-end; background: rgba(232,40,63,0.14); border-color: rgba(232,40,63,0.35); border-radius: 14px 14px 4px 14px; }
/* floating chat button */
/* albums grid */
.albums-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 14px; }
.album-card { position: relative; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; overflow: hidden; text-align: left; transition: transform .15s ease; }
.album-card:hover { transform: translateY(-3px); }
.album-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; aspect-ratio: 1; }
.album-cell { overflow: hidden; background: var(--panel); }
.album-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* edit profile modal */
.edit-profile-banner { height: 80px; border-radius: 0; position: relative; overflow: hidden; margin: -30px -28px 0; }
.avatar-lg-wrap { width: 68px; height: 68px; border-radius: 999px; border: 3px solid var(--bg); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.banner-swatch { width: 28px; height: 28px; border-radius: 999px; border: 2px solid transparent; transition: outline .1s; }

/* device frame — polished and actually scaled */
.device-frame-bg { background: rgba(0,0,0,0.85); min-height: calc(100vh - 120px); padding: 20px 12px 32px; display: flex; justify-content: center; align-items: flex-start; overflow-x: auto; }
.device-frame-inner { background: var(--bg); border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px rgba(255,255,255,0.14), 0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1); transition: width .35s cubic-bezier(.16,1,.3,1), min-width .35s cubic-bezier(.16,1,.3,1); width: 100%; min-width: 0; flex-shrink: 0; }
.device-phone { width: 393px !important; min-width: 393px !important; }
.device-tablet { width: 820px !important; min-width: 820px !important; }
.device-desktop { width: min(1280px, 96vw) !important; }
.device-chrome { background: #1e1e1e; border-bottom: 1px solid rgba(255,255,255,0.1); }
.device-chrome-bar { display: flex; align-items: center; padding: 9px 12px; gap: 6px; }
.device-chrome-dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.device-screen { overflow-y: auto; overflow-x: hidden; max-height: calc(100vh - 180px); }
.device-preview-stage { display: flex; justify-content: center; padding: 20px 0 40px; }

.chat-fab { position: fixed; bottom: 28px; left: 22px; z-index: 87; width: 52px; height: 52px; border-radius: 999px; background: #E8283F; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(232,40,63,0.45); transition: box-shadow .15s ease; }
.chat-fab:hover { transform: scale(1.08); box-shadow: 0 12px 30px rgba(232,40,63,0.55); }
.chat-fab-dot { position: absolute; top: 4px; right: 4px; width: 10px; height: 10px; background: #fff; border-radius: 999px; border: 2px solid #E8283F; animation: pulse-dot 2s infinite; }
.live-dot-green { display: inline-block; width: 7px; height: 7px; border-radius: 999px; background: #22c55e; animation: pulse-dot 1.6s infinite; }
.live-dot-amber { display: inline-block; width: 7px; height: 7px; border-radius: 999px; background: #f0c14b; }
@keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }
.featured-creator-banner { display: flex; align-items: center; gap: 14px; background: var(--glass-bg); backdrop-filter: blur(20px) saturate(160%); border: 1px solid var(--glass-border); border-radius: 18px; padding: 14px 18px; }
.coming-soon-card { text-align: center; padding: 70px 24px; border: 1px solid var(--border); border-radius: 24px; background: var(--glass-bg); backdrop-filter: blur(16px); }
.download-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 18px; padding: 20px 22px; }
.download-code { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; color: var(--fog); margin-top: 6px; letter-spacing: 0.04em; }
.episode-num-tag { position: absolute; top: 8px; left: 8px; background: rgba(232,40,63,0.85); color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; }

/* anime cover grid — like MAL/AniList browsing */
.anime-cover-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 16px; }
@media (min-width: 640px) { .anime-cover-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); } }
@media (min-width: 1024px) { .anime-cover-grid { grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); } }
.anime-cover-card { text-align: left; transition: transform .15s ease; }
.anime-cover-card:hover { transform: translateY(-3px); }
.anime-cover-thumb { position: relative; width: 100%; aspect-ratio: 2/3; border-radius: 10px; overflow: hidden; background: var(--panel); margin-bottom: 8px; }
.anime-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.anime-cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.anime-score-badge { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.72); color: #f0c14b; font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; letter-spacing: 0.04em; padding: 3px 7px; border-radius: 999px; font-weight: 600; }
.anime-cover-title { font-family: 'Archivo Black', sans-serif; font-size: 0.78rem; color: var(--fog); line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.anime-cover-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); margin-top: 3px; }

/* anime news grid — 2-col cards with cover + text */
.anime-news-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (min-width: 768px) { .anime-news-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .anime-news-grid { grid-template-columns: repeat(4, 1fr); } }
.anime-news-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 14px; overflow: hidden; }
.anime-news-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; display: block; }
.anime-news-body { padding: 10px 12px 12px; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.anime-news-item { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 14px; padding: 12px 14px; }
.news-cat-badge { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; background: rgba(232,40,63,0.18); color: #E8283F; padding: 2px 8px; border-radius: 999px; margin-bottom: 6px; }
.anime-airing-dot { position: absolute; top: 6px; left: 6px; width: 8px; height: 8px; background: #22c55e; border-radius: 999px; border: 2px solid var(--bg); animation: pulse-dot 2s infinite; }
.dub-badge { position: absolute; bottom: 8px; right: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; font-weight: 600; }
.dub-sub { background: rgba(45,226,230,0.2); color: #2DE2E6; }
.dub-dub { background: rgba(232,40,63,0.2); color: #E8283F; }
.dub-both { background: rgba(232,180,40,0.2); color: #f0c14b; }
.field-input::placeholder { color: #5e5b5d; }
.field-input:focus { outline: none; border-color: #E8283F; }

/* toast */
.toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); background: var(--glass-bg); backdrop-filter: blur(20px) saturate(160%); border: 1px solid var(--glass-border); color: var(--fog); font-size: 0.85rem; padding: 11px 22px; border-radius: 999px; z-index: 95; box-shadow: 0 10px 28px rgba(0,0,0,0.4); }

/* carousel rows (browse-by-title / browse-by-type) */
.carousel-row { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 10px; scroll-snap-type: x proximate; -webkit-overflow-scrolling: touch; }
.carousel-row::-webkit-scrollbar { height: 6px; }
.carousel-row::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 999px; }
.carousel-item { flex: 0 0 auto; scroll-snap-align: start; }

/* watermark */
.watermark { position: fixed; bottom: 10px; right: 12px; z-index: 70; font-family: 'JetBrains Mono', monospace; font-size: 0.62rem; letter-spacing: 0.08em; color: rgba(237,235,234,0.32); pointer-events: none; text-transform: uppercase; }

/* accessibility: keyboard focus */
a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid #2DE2E6; outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .glitch-title::before, .glitch-title::after, .petal { animation: none !important; }
  * { transition-duration: 0.01ms !important; }
}
`;
